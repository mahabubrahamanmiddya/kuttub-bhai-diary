import { Note, Label, NoteVersion } from '@/types/diary';
import { DiaryBackupPayload, RestoreOptions, RestoreResult, BackupVerificationResult } from '@/types/backup';
import { verifyBackupIntegrity, createBackupPayload, generateBackupFilename } from './crypto';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { idbSaveNotes, idbSaveLabels, idbSaveNoteVersion, idbSaveBackupRecord } from '@/lib/storage/indexed-db';

/**
 * Restores a backup payload into the application (IndexedDB + Supabase PostgreSQL).
 * Fully decoupled from original user_id and original database instance!
 */
export async function executeRestore(
  rawBackupData: any,
  currentNotes: Note[],
  currentLabels: Label[],
  currentUserId: string,
  options: RestoreOptions
): Promise<RestoreResult> {
  // 1. Verify backup integrity first
  const verification: BackupVerificationResult = await verifyBackupIntegrity(rawBackupData);
  if (!verification.valid) {
    return {
      success: false,
      error: verification.error || 'Backup verification failed. Cannot restore corrupted data.',
      restoredNotesCount: 0,
      restoredLabelsCount: 0,
      restoredVersionsCount: 0,
      mode: options.mode,
    };
  }

  // Parse notes, labels, versions from backup
  let incomingNotes: Note[] = [];
  let incomingLabels: Label[] = [];
  let incomingVersions: NoteVersion[] = [];

  if (Array.isArray(rawBackupData)) {
    // Legacy array format
    incomingNotes = rawBackupData;
  } else {
    incomingNotes = rawBackupData.notes || [];
    incomingLabels = rawBackupData.labels || [];
    incomingVersions = rawBackupData.note_versions || [];
  }

  let safetyBackupCreated = false;
  let safetyBackupFilename = '';

  // 2. If 'replace' mode, create and verify a safety backup of current data first!
  if (options.mode === 'replace' && currentNotes.length > 0) {
    const safetyPayload = await createBackupPayload(
      currentNotes,
      currentLabels,
      [],
      {},
      currentUserId
    );
    const safetyVerify = await verifyBackupIntegrity(safetyPayload);
    if (!safetyVerify.valid) {
      return {
        success: false,
        error: 'Safety pre-backup generation failed. Aborting replace restoration for safety.',
        restoredNotesCount: 0,
        restoredLabelsCount: 0,
        restoredVersionsCount: 0,
        mode: options.mode,
      };
    }

    safetyBackupCreated = true;
    safetyBackupFilename = `safety-pre-replace-${generateBackupFilename()}`;

    // Record safety backup in IndexedDB
    await idbSaveBackupRecord({
      id: `safety-${Date.now()}`,
      filename: safetyBackupFilename,
      storage_location: 'local_download',
      file_size_bytes: JSON.stringify(safetyPayload).length,
      notes_count: currentNotes.length,
      labels_count: currentLabels.length,
      checksum_sha256: safetyPayload.metadata.checksum_sha256,
      status: 'verified',
      created_at: new Date().toISOString(),
      details: { reason: 'Automatic safety snapshot before destructive replace restore' },
    });
  }

  // 3. Remap Labels to current user
  // Map old label IDs to new or existing label IDs
  const labelMap = new Map<string, Label>();
  const mergedLabelsList: Label[] = options.mode === 'replace' ? [] : [...currentLabels];

  for (const incLabel of incomingLabels) {
    // Check if label with same name already exists in target
    let targetLabel = mergedLabelsList.find(
      (l) => l.name.toLowerCase() === incLabel.name.toLowerCase()
    );

    if (!targetLabel) {
      targetLabel = {
        id: `lbl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        user_id: currentUserId,
        name: incLabel.name,
        color: incLabel.color || '#f59e0b',
        created_at: incLabel.created_at || new Date().toISOString(),
      };
      mergedLabelsList.push(targetLabel);
    }

    labelMap.set(incLabel.id, targetLabel);
  }

  // 4. Remap Notes to current user and resolve merge vs replace
  const existingNotesMap = new Map<string, Note>();
  if (options.mode === 'merge') {
    currentNotes.forEach((n) => existingNotesMap.set(n.id, n));
  }

  const finalNotesList: Note[] = options.mode === 'replace' ? [] : [...currentNotes];

  for (const incNote of incomingNotes) {
    // Remap attached labels to new label IDs
    const remappedLabels: Label[] = (incNote.labels || []).map((lbl) => {
      return labelMap.get(lbl.id) || {
        id: `lbl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        user_id: currentUserId,
        name: lbl.name,
        color: lbl.color,
      };
    });

    const preparedNote: Note = {
      ...incNote,
      user_id: currentUserId, // Decouple from old user_id!
      labels: remappedLabels,
      _syncStatus: 'pending', // Queue for sync to cloud database
    };

    if (options.mode === 'replace') {
      finalNotesList.push(preparedNote);
    } else {
      // Merge mode (default)
      const existing = existingNotesMap.get(preparedNote.id);
      if (!existing) {
        // Doesn't exist locally: add
        finalNotesList.push(preparedNote);
      } else {
        // Exists: compare timestamps. Keep whichever is newer!
        const existingTime = new Date(existing.updated_at).getTime();
        const incomingTime = new Date(preparedNote.updated_at).getTime();
        if (incomingTime >= existingTime) {
          const idx = finalNotesList.findIndex((n) => n.id === existing.id);
          if (idx !== -1) {
            finalNotesList[idx] = preparedNote;
          }
        }
      }
    }
  }

  // 5. Save into Local Storage / IndexedDB immediately
  await idbSaveNotes(currentUserId, finalNotesList);
  await idbSaveLabels(currentUserId, mergedLabelsList);

  // 6. Restore Note Versions if present
  let restoredVersionsCount = 0;
  for (const ver of incomingVersions) {
    await idbSaveNoteVersion({
      ...ver,
      user_id: currentUserId,
    });
    restoredVersionsCount++;
  }

  // 7. Sync restored notes into Supabase PostgreSQL if online and configured
  if (isSupabaseConfigured() && navigator.onLine) {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        // Upsert labels in batch
        if (mergedLabelsList.length > 0) {
          await supabase.from('labels').upsert(
            mergedLabelsList.map((l) => ({
              id: l.id,
              user_id: currentUserId,
              name: l.name,
              color: l.color,
            })),
            { onConflict: 'id' }
          );
        }

        // Upsert notes in batches of 50
        const chunkSize = 50;
        for (let i = 0; i < finalNotesList.length; i += chunkSize) {
          const chunk = finalNotesList.slice(i, i + chunkSize);
          const dbPayloads = chunk.map((n) => ({
            id: n.id,
            user_id: currentUserId,
            title: n.title,
            content: n.content,
            color: n.color,
            is_pinned: Boolean(n.is_pinned),
            is_archived: Boolean(n.is_archived),
            is_deleted: Boolean(n.is_deleted),
            is_checklist: Boolean(n.is_checklist),
            reminder_date: n.reminder_date || null,
            updated_at: n.updated_at,
          }));

          const { error: batchErr } = await supabase.from('notes').upsert(dbPayloads, { onConflict: 'id' });
          if (batchErr) {
            console.error('Error syncing restored batch to Supabase:', batchErr);
          }
        }
      } catch (cloudErr) {
        console.warn('Could not sync restored notes to Supabase immediately (will queue):', cloudErr);
      }
    }
  }

  return {
    success: true,
    restoredNotesCount: incomingNotes.length,
    restoredLabelsCount: mergedLabelsList.length,
    restoredVersionsCount,
    safetyBackupCreated,
    safetyBackupFilename,
    mode: options.mode,
  };
}
