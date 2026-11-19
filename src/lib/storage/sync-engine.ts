import { Note, Label } from '@/types/diary';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/client';
import {
  loadSyncQueue,
  saveSyncQueue,
  loadLocalNotes,
  saveLocalNotes,
  loadLocalLabels,
  saveLocalLabels,
} from './offline-store';

export async function pushQueueToSupabase(userId: string): Promise<{ success: boolean; syncedCount: number }> {
  if (!navigator.onLine || !isSupabaseConfigured()) {
    return { success: false, syncedCount: 0 };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { success: false, syncedCount: 0 };

  const queue = loadSyncQueue();
  if (queue.length === 0) return { success: true, syncedCount: 0 };

  const remainingQueue = [...queue];
  let syncedCount = 0;

  for (const item of queue) {
    try {
      if (item.action === 'UPSERT_NOTE') {
        const note: Note = item.payload;
        // Make sure user_id is the authenticated user ID
        const dbPayload = {
          id: note.id,
          user_id: userId,
          title: note.title,
          content: note.content,
          color: note.color,
          is_pinned: note.is_pinned,
          is_archived: note.is_archived,
          is_deleted: note.is_deleted,
          is_checklist: Boolean(note.is_checklist),
          reminder_date: note.reminder_date || null,
          updated_at: note.updated_at,
        };

        const { error: noteError } = await supabase
          .from('notes')
          .upsert(dbPayload, { onConflict: 'id' });

        if (noteError) {
          console.error('Error syncing note to Supabase:', noteError);
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

        // Successfully synced
        const index = remainingQueue.findIndex((q) => q.id === item.id && q.action === item.action);
        if (index !== -1) remainingQueue.splice(index, 1);
        syncedCount++;
      } else if (item.action === 'DELETE_NOTE') {
        const { error } = await supabase.from('notes').delete().eq('id', item.id);
        if (!error) {
          const index = remainingQueue.findIndex((q) => q.id === item.id && q.action === item.action);
          if (index !== -1) remainingQueue.splice(index, 1);
          syncedCount++;
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
          syncedCount++;
        }
      } else if (item.action === 'DELETE_LABEL') {
        const { error } = await supabase.from('labels').delete().eq('id', item.id);
        if (!error) {
          const index = remainingQueue.findIndex((q) => q.id === item.id && q.action === item.action);
          if (index !== -1) remainingQueue.splice(index, 1);
          syncedCount++;
        }
      }
    } catch (e) {
      console.error('Queue processing error:', e);
    }
  }

  saveSyncQueue(remainingQueue);
  return { success: remainingQueue.length === 0, syncedCount };
}

export async function fetchAllFromSupabase(userId: string): Promise<{ notes: Note[]; labels: Label[] } | null> {
  if (!navigator.onLine || !isSupabaseConfigured()) {
    return null;
  }

  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    // 1. Fetch Labels
    const { data: labelsData, error: labelsError } = await supabase
      .from('labels')
      .select('*')
      .order('name', { ascending: true });

    if (labelsError) {
      console.error('Failed to fetch labels from Supabase:', labelsError);
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
      return null;
    }

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

      // Parse checklist items if note is marked as checklist or contains □ / [ ]
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
      };
    });

    return { notes: fetchedNotes, labels: fetchedLabels };
  } catch (e) {
    console.error('Exception fetching from Supabase:', e);
    return null;
  }
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
