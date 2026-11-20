import { Note, Label, NoteVersion } from '@/types/diary';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/client';
import {
  loadSyncQueue,
  saveSyncQueue,
  idbRemoveFromSyncQueue,
  idbSaveNoteVersion,
} from './offline-store';

export interface PushQueueResult {
  success: boolean;
  syncedCount: number;
  failedCount: number;
  error?: string;
}

export interface FetchRemoteResult {
  success: boolean;
  notes: Note[] | null;
  labels: Label[] | null;
  versions?: NoteVersion[];
  error?: string;
  isDatabaseUnavailable?: boolean;
}

/**
 * Pushes queued offline changes to Supabase PostgreSQL with idempotent upserts,
 * retry protection, and error tracking.
 */
export async function pushQueueToSupabase(userId: string): Promise<PushQueueResult> {
  if (!navigator.onLine || !isSupabaseConfigured()) {
    return { success: false, syncedCount: 0, failedCount: 0, error: 'Offline or Supabase unconfigured' };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { success: false, syncedCount: 0, failedCount: 0, error: 'No client' };

  const queue = loadSyncQueue();
  if (queue.length === 0) return { success: true, syncedCount: 0, failedCount: 0 };

  const remainingQueue = [...queue];
  let syncedCount = 0;
  let failedCount = 0;

  for (const item of queue) {
    try {
      if (item.action === 'UPSERT_NOTE') {
        const note: Note = item.payload;
        const dbPayload = {
          id: note.id,
          user_id: userId,
          title: note.title,
          content: note.content,
          color: note.color,
          is_pinned: Boolean(note.is_pinned),
          is_archived: Boolean(note.is_archived),
          is_deleted: Boolean(note.is_deleted),
          is_checklist: Boolean(note.is_checklist),
          reminder_date: note.reminder_date || null,
          updated_at: note.updated_at,
        };

        const { error: noteError } = await supabase
          .from('notes')
          .upsert(dbPayload, { onConflict: 'id' });

        if (noteError) {
          console.error('Error syncing note to Supabase:', noteError);
          failedCount++;
          continue;
        }

        // Sync note labels
        if (note.labels && note.labels.length >= 0) {
          await supabase.from('note_labels').delete().eq('note_id', note.id);
          if (note.labels.length > 0) {
            const labelRows = note.labels.map((lbl) => ({
              note_id: note.id,
              label_id: lbl.id,
            }));
            await supabase.from('note_labels').insert(labelRows);
          }
        }

        // Successfully synced: remove from queue
        const index = remainingQueue.findIndex((q) => q.id === item.id && q.action === item.action);
        if (index !== -1) remainingQueue.splice(index, 1);
        await idbRemoveFromSyncQueue(item.id, item.action);
        syncedCount++;
      } else if (item.action === 'DELETE_NOTE') {
        const { error } = await supabase.from('notes').delete().eq('id', item.id);
        if (!error) {
          const index = remainingQueue.findIndex((q) => q.id === item.id && q.action === item.action);
          if (index !== -1) remainingQueue.splice(index, 1);
          await idbRemoveFromSyncQueue(item.id, item.action);
          syncedCount++;
        } else {
          failedCount++;
        }
      } else if (item.action === 'UPSERT_LABEL') {
        const label: Label = item.payload;
        const { error } = await supabase.from('labels').upsert(
          {
            id: label.id,
            user_id: userId,
            name: label.name,
            color: label.color || '#f59e0b',
          },
          { onConflict: 'id' }
        );
        if (!error) {
          const index = remainingQueue.findIndex((q) => q.id === item.id && q.action === item.action);
          if (index !== -1) remainingQueue.splice(index, 1);
          await idbRemoveFromSyncQueue(item.id, item.action);
          syncedCount++;
        } else {
          failedCount++;
        }
      } else if (item.action === 'DELETE_LABEL') {
        const { error } = await supabase.from('labels').delete().eq('id', item.id);
        if (!error) {
          const index = remainingQueue.findIndex((q) => q.id === item.id && q.action === item.action);
          if (index !== -1) remainingQueue.splice(index, 1);
          await idbRemoveFromSyncQueue(item.id, item.action);
          syncedCount++;
        } else {
          failedCount++;
        }
      }
    } catch (e: any) {
      console.error('Queue processing error:', e);
      failedCount++;
    }
  }

  saveSyncQueue(remainingQueue);
  return {
    success: remainingQueue.length === 0,
    syncedCount,
    failedCount,
    error: failedCount > 0 ? `${failedCount} items failed to synchronize` : undefined,
  };
}

/**
 * Fetches notes from Supabase.
 * CRITICAL PROTECTION: If the database is unreachable or returns an error,
 * returns isDatabaseUnavailable: true and NEVER returns an empty array,
 * preventing accidental deletion of local notes!
 */
export async function fetchAllFromSupabase(userId: string): Promise<FetchRemoteResult> {
  if (!navigator.onLine || !isSupabaseConfigured()) {
    return {
      success: false,
      notes: null,
      labels: null,
      isDatabaseUnavailable: true,
      error: 'Device is offline or Supabase is not configured',
    };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return {
      success: false,
      notes: null,
      labels: null,
      isDatabaseUnavailable: true,
      error: 'Supabase client initialization failed',
    };
  }

  try {
    // 1. Fetch Labels
    const { data: labelsData, error: labelsError } = await supabase
      .from('labels')
      .select('*')
      .order('name', { ascending: true });

    if (labelsError) {
      console.error('Failed to fetch labels from Supabase:', labelsError);
      return {
        success: false,
        notes: null,
        labels: null,
        isDatabaseUnavailable: true,
        error: `Supabase database error: ${labelsError.message}`,
      };
    }

    const fetchedLabels: Label[] = (labelsData || []).map((l: any) => ({
      id: l.id,
      user_id: l.user_id,
      name: l.name,
      color: l.color || '#f59e0b',
      created_at: l.created_at,
    }));

    // 2. Fetch Notes with joined labels
    const { data: notesData, error: notesError } = await supabase
      .from('notes')
      .select(`
        *,
        note_labels (
          label_id,
          labels (
            id,
            name,
            color
          )
        )
      `)
      .order('updated_at', { ascending: false });

    if (notesError) {
      console.error('Failed to fetch notes from Supabase:', notesError);
      return {
        success: false,
        notes: null,
        labels: null,
        isDatabaseUnavailable: true,
        error: `Supabase database error: ${notesError.message}`,
      };
    }

    // 3. Fetch Note Versions (if table exists)
    let fetchedVersions: NoteVersion[] = [];
    try {
      const { data: versionsData } = await supabase
        .from('note_versions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (versionsData) {
        fetchedVersions = versionsData.map((v: any) => ({
          id: v.id,
          note_id: v.note_id,
          user_id: v.user_id,
          title: v.title,
          content: v.content,
          color: v.color || 'default',
          is_checklist: Boolean(v.is_checklist),
          version_number: v.version_number || 1,
          change_summary: v.change_summary,
          created_at: v.created_at,
        }));
      }
    } catch {}

    const fetchedNotes: Note[] = (notesData || []).map((n: any) => {
      const labels: Label[] = (n.note_labels || [])
        .map((nl: any) => nl.labels)
        .filter(Boolean)
        .map((lbl: any) => ({
          id: lbl.id,
          user_id: userId,
          name: lbl.name,
          color: lbl.color,
        }));

      let checklist_items = undefined;
      if (n.is_checklist) {
        checklist_items = parseChecklistFromContent(n.content);
      }

      return {
        id: n.id,
        user_id: n.user_id,
        title: n.title || '',
        content: n.content || '',
        color: n.color || 'default',
        is_pinned: Boolean(n.is_pinned),
        is_archived: Boolean(n.is_archived),
        is_deleted: Boolean(n.is_deleted),
        is_checklist: Boolean(n.is_checklist),
        checklist_items,
        reminder_date: n.reminder_date || null,
        created_at: n.created_at,
        updated_at: n.updated_at,
        labels,
        _syncStatus: 'synced',
        _lastSyncedAt: new Date().toISOString(),
        _baseUpdatedAt: n.updated_at,
      };
    });

    return {
      success: true,
      notes: fetchedNotes,
      labels: fetchedLabels,
      versions: fetchedVersions,
    };
  } catch (e: any) {
    console.error('Exception connecting to Supabase database:', e);
    return {
      success: false,
      notes: null,
      labels: null,
      isDatabaseUnavailable: true,
      error: e?.message || 'Database connection failure',
    };
  }
}

/**
 * Intelligent Conflict Detection and Merge:
 * Combines local notes with remote notes without ever silently overwriting newer content.
 * If a conflict is detected, saves a historical checkpoint and preserves both versions.
 */
export async function mergeNotesWithConflictResolution(
  localNotes: Note[],
  remoteNotes: Note[],
  pendingQueue: { action: string; id: string }[]
): Promise<{ merged: Note[]; conflictsResolved: number }> {
  const pendingIds = new Set(pendingQueue.filter((q) => q.action === 'UPSERT_NOTE').map((q) => q.id));
  const localMap = new Map<string, Note>();
  localNotes.forEach((n) => localMap.set(n.id, n));

  const mergedMap = new Map<string, Note>();
  let conflictsResolved = 0;

  // Process remote notes
  for (const remoteNote of remoteNotes) {
    const local = localMap.get(remoteNote.id);

    if (!local) {
      // Note exists only remotely -> add to merged
      mergedMap.set(remoteNote.id, remoteNote);
      continue;
    }

    // Note exists in both local and remote:
    const isPendingLocalEdit = pendingIds.has(local.id);

    if (!isPendingLocalEdit) {
      // Local has no unsynced edits: accept remote version
      mergedMap.set(remoteNote.id, {
        ...remoteNote,
        _syncStatus: 'synced',
        _baseUpdatedAt: remoteNote.updated_at,
      });
      continue;
    }

    // Local HAS unsynced changes. Check if remote also changed!
    const remoteTime = new Date(remoteNote.updated_at).getTime();
    const baseTime = local._baseUpdatedAt ? new Date(local._baseUpdatedAt).getTime() : 0;

    if (remoteTime > baseTime && (remoteNote.title !== local.title || remoteNote.content !== local.content)) {
      // CONFLICT DETECTED!
      // Remote was modified by another device while local had un-synced edits.
      conflictsResolved++;

      // 1. Save local version into version history so it can never be lost
      await idbSaveNoteVersion({
        id: `conflict-${Date.now()}-${local.id.slice(0, 8)}`,
        note_id: local.id,
        user_id: local.user_id,
        title: local.title,
        content: local.content,
        color: local.color,
        is_checklist: Boolean(local.is_checklist),
        version_number: 999,
        change_summary: `Conflict checkpoint (offline local edit from ${new Date(local.updated_at).toLocaleTimeString()})`,
        created_at: local.updated_at,
      });

      // 2. Create a non-destructive conflict copy note alongside the primary note
      const conflictCopy: Note = {
        ...local,
        id: `conflict-copy-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title: `${local.title} (Conflicted Local Copy)`,
        _isConflict: true,
        _syncStatus: 'pending',
        updated_at: new Date().toISOString(),
      };

      // Keep remote note as main, and add conflict copy so user can review and compare
      mergedMap.set(remoteNote.id, remoteNote);
      mergedMap.set(conflictCopy.id, conflictCopy);
    } else {
      // Local is newer and remote didn't change -> keep local and let it push
      mergedMap.set(local.id, local);
    }
  }

  // Include any local notes that don't exist on remote at all (created offline)
  for (const local of localNotes) {
    if (!mergedMap.has(local.id)) {
      mergedMap.set(local.id, local);
    }
  }

  // Sort by updated_at descending
  const sorted = Array.from(mergedMap.values()).sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );

  return { merged: sorted, conflictsResolved };
}

export function parseChecklistFromContent(content: string) {
  if (!content) return [];
  const lines = content.split('\n');
  return lines.map((line, index) => {
    const isCompleted = line.startsWith('☑') || line.startsWith('[x]') || line.startsWith('[X]');
    const isBox = line.startsWith('□') || line.startsWith('[ ]') || isCompleted;
    let cleanText = line;
    if (isCompleted) {
      cleanText = line.replace(/^(☑|\[x\]|\[X\])\s*/, '');
    } else if (isBox) {
      cleanText = line.replace(/^(□|\[\s*\])\s*/, '');
    }
    return {
      id: `item-${index}`,
      text: cleanText,
      completed: isCompleted,
    };
  });
}
