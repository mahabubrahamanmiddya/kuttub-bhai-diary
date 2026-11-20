'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Note, Label, ViewFilter, SyncState, NoteColor, NoteVersion } from '@/types/diary';
import { RestoreOptions, RestoreResult } from '@/types/backup';
import { useAuth } from './auth-context';
import {
  initializeOfflineStore,
  saveLocalNotes,
  saveLocalLabels,
  addToSyncQueue,
  loadSyncQueue,
  idbGetNoteVersions,
} from '@/lib/storage/offline-store';
import {
  pushQueueToSupabase,
  fetchAllFromSupabase,
  mergeNotesWithConflictResolution,
} from '@/lib/storage/sync-engine';
import { createNoteVersionCheckpoint, getNoteVersionHistory } from '@/lib/storage/versioning';
import { executeRestore } from '@/lib/backup/restoration';
import { isSupabaseConfigured } from '@/lib/supabase/client';

interface NotesContextType {
  notes: Note[];
  labels: Label[];
  viewFilter: ViewFilter;
  setViewFilter: (filter: ViewFilter) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  syncState: SyncState;
  syncStatusMessage: string;
  isOnline: boolean;
  isDatabaseConnected: boolean;
  databaseWarning: string | null;
  activeNote: Note | null;
  setActiveNote: (note: Note | null) => void;
  isEditorOpen: boolean;
  setIsEditorOpen: (open: boolean) => void;
  viewMode: 'grid' | 'list';
  setViewMode: (mode: 'grid' | 'list') => void;

  // Actions
  createNote: (initialData?: Partial<Note>) => Note;
  saveNoteDebounced: (noteId: string, updates: Partial<Note>) => Promise<void>;
  saveNoteImmediate: (noteId: string, updates: Partial<Note>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  restoreNote: (id: string) => Promise<void>;
  permanentDeleteNote: (id: string) => Promise<void>;
  emptyTrash: () => Promise<void>;
  togglePin: (id: string) => Promise<void>;
  toggleArchive: (id: string) => Promise<void>;
  updateNoteColor: (id: string, color: NoteColor) => Promise<void>;

  // Labels
  createLabel: (name: string, color?: string) => Promise<Label>;
  deleteLabel: (id: string) => Promise<void>;
  toggleNoteLabel: (noteId: string, label: Label) => Promise<void>;

  // Version History
  createVersionSnapshot: (note: Note, summary?: string) => Promise<NoteVersion>;
  getVersionsForNote: (noteId: string) => Promise<NoteVersion[]>;
  restoreVersion: (noteId: string, version: NoteVersion) => Promise<void>;

  // Restore & Sync
  restoreFromBackupData: (rawPayload: any, options: RestoreOptions) => Promise<RestoreResult>;
  triggerSync: () => Promise<void>;
}

const NotesContext = createContext<NotesContextType | undefined>(undefined);

export function NotesProvider({ children }: { children: React.ReactNode }) {
  const { user, isConfigured } = useAuth();
  const userId = user?.id || 'guest-user';

  const [notes, setNotes] = useState<Note[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [viewFilter, setViewFilter] = useState<ViewFilter>('notes');
  const [searchQuery, setSearchQuery] = useState('');
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [syncStatusMessage, setSyncStatusMessage] = useState<string>('Saved on device');
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isDatabaseConnected, setIsDatabaseConnected] = useState<boolean>(true);
  const [databaseWarning, setDatabaseWarning] = useState<string | null>(null);
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const debounceTimerRef = useRef<{ [key: string]: NodeJS.Timeout }>({});

  // 1. Online / Offline listeners
  useEffect(() => {
    setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);

    const handleOnline = () => {
      setIsOnline(true);
      setSyncState('waiting_sync');
      setSyncStatusMessage('Waiting for synchronization');
      triggerSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setSyncState('offline');
      setSyncStatusMessage("Offline — changes will sync when you're back online");
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 2. Initialize from IndexedDB on startup
  useEffect(() => {
    initializeOfflineStore(userId).then(({ notes: idbNotes, labels: idbLabels }) => {
      setNotes(idbNotes);
      setLabels(idbLabels);

      // Once local state is populated, attempt cloud sync if online and configured
      if (isConfigured && navigator.onLine) {
        triggerSync();
      }
    });
  }, [userId, isConfigured]);

  // 3. Robust Cloud Synchronization Engine
  const triggerSync = useCallback(async () => {
    if (!navigator.onLine) {
      setSyncState('offline');
      setSyncStatusMessage("Offline — changes will sync when you're back online");
      return;
    }

    if (!isConfigured) {
      setSyncState('saved_device');
      setSyncStatusMessage('Saved on device');
      setTimeout(() => setSyncState('idle'), 2500);
      return;
    }

    try {
      setSyncState('saving');
      setSyncStatusMessage('Saving...');

      // 1. Push any queued changes to Supabase
      const pushResult = await pushQueueToSupabase(userId);

      // 2. Fetch fresh notes & labels from Supabase
      const remoteData = await fetchAllFromSupabase(userId);

      if (remoteData.isDatabaseUnavailable) {
        // CRITICAL PROTECTION: Database error / unavailable
        // We NEVER clear or replace local notes!
        setIsDatabaseConnected(false);
        setDatabaseWarning(remoteData.error || 'Database temporarily unreachable');
        setSyncState('waiting_sync');
        setSyncStatusMessage('Waiting for synchronization');
        return;
      }

      setIsDatabaseConnected(true);
      setDatabaseWarning(null);

      if (remoteData.success && remoteData.notes && remoteData.labels) {
        const queue = loadSyncQueue();
        const { merged } = await mergeNotesWithConflictResolution(notes, remoteData.notes, queue);

        setNotes(merged);
        saveLocalNotes(userId, merged);

        if (remoteData.labels.length > 0) {
          setLabels(remoteData.labels);
          saveLocalLabels(userId, remoteData.labels);
        }

        if (pushResult.failedCount > 0) {
          setSyncState('sync_failed');
          setSyncStatusMessage('Synchronization failed');
        } else {
          setSyncState('saved_cloud');
          setSyncStatusMessage('Saved to cloud');
          setTimeout(() => setSyncState('idle'), 3000);
        }
      } else {
        setSyncState('saved_device');
        setSyncStatusMessage('Saved on device');
      }
    } catch (e: any) {
      console.error('Sync failed:', e);
      setSyncState('sync_failed');
      setSyncStatusMessage('Synchronization failed');
    }
  }, [userId, isConfigured, notes]);

  // Create Note
  const createNote = useCallback(
    (initialData?: Partial<Note>): Note => {
      const now = new Date().toISOString();
      const newNote: Note = {
        id: `note-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        user_id: userId,
        title: initialData?.title || '',
        content: initialData?.content || '',
        color: initialData?.color || 'default',
        is_pinned: initialData?.is_pinned || false,
        is_archived: initialData?.is_archived || false,
        is_deleted: false,
        is_checklist: initialData?.is_checklist || false,
        checklist_items: initialData?.checklist_items || [],
        reminder_date: initialData?.reminder_date || null,
        labels: initialData?.labels || [],
        created_at: now,
        updated_at: now,
        _syncStatus: 'pending',
        _baseUpdatedAt: now,
      };

      setNotes((prev) => {
        const next = [newNote, ...prev];
        saveLocalNotes(userId, next);
        return next;
      });

      addToSyncQueue({
        id: newNote.id,
        action: 'UPSERT_NOTE',
        payload: newNote,
      });

      if (!navigator.onLine) {
        setSyncState('saved_device');
        setSyncStatusMessage('Saved on device');
      } else if (isConfigured) {
        setSyncState('saving');
        setSyncStatusMessage('Saving...');
        pushQueueToSupabase(userId).then((res) => {
          if (res.success) {
            setSyncState('saved_cloud');
            setSyncStatusMessage('Saved to cloud');
            setTimeout(() => setSyncState('idle'), 2500);
          } else {
            setSyncState('waiting_sync');
            setSyncStatusMessage('Waiting for synchronization');
          }
        });
      } else {
        setSyncState('saved_device');
        setSyncStatusMessage('Saved on device');
        setTimeout(() => setSyncState('idle'), 2000);
      }

      setActiveNote(newNote);
      setIsEditorOpen(true);
      return newNote;
    },
    [userId, isConfigured]
  );

  // Save Note Immediate
  const saveNoteImmediate = useCallback(
    async (noteId: string, updates: Partial<Note>): Promise<void> => {
      const now = new Date().toISOString();
      let updatedNote: Note | null = null;

      setNotes((prev) => {
        const next = prev.map((note) => {
          if (note.id === noteId) {
            updatedNote = {
              ...note,
              ...updates,
              updated_at: now,
              _syncStatus: 'pending',
            };
            return updatedNote;
          }
          return note;
        });
        saveLocalNotes(userId, next);
        return next;
      });

      if (updatedNote) {
        if (activeNote?.id === noteId) {
          setActiveNote(updatedNote);
        }

        addToSyncQueue({
          id: noteId,
          action: 'UPSERT_NOTE',
          payload: updatedNote,
        });

        if (!navigator.onLine) {
          setSyncState('saved_device');
          setSyncStatusMessage('Saved on device');
        } else if (isConfigured) {
          setSyncState('saving');
          setSyncStatusMessage('Saving...');
          const res = await pushQueueToSupabase(userId);
          if (res.success) {
            setSyncState('saved_cloud');
            setSyncStatusMessage('Saved to cloud');
            setTimeout(() => setSyncState('idle'), 2500);
          } else {
            setSyncState('waiting_sync');
            setSyncStatusMessage('Waiting for synchronization');
          }
        } else {
          setSyncState('saved_device');
          setSyncStatusMessage('Saved on device');
          setTimeout(() => setSyncState('idle'), 2000);
        }
      }
    },
    [userId, isConfigured, activeNote]
  );

  // Debounced auto-save while typing
  const saveNoteDebounced = useCallback(
    async (noteId: string, updates: Partial<Note>): Promise<void> => {
      setSyncState('saving');
      setSyncStatusMessage('Saving...');

      const now = new Date().toISOString();
      setNotes((prev) => {
        const next = prev.map((n) => {
          if (n.id === noteId) {
            const upd = { ...n, ...updates, updated_at: now };
            if (activeNote?.id === noteId) {
              setActiveNote(upd);
            }
            return upd;
          }
          return n;
        });
        saveLocalNotes(userId, next);
        return next;
      });

      if (debounceTimerRef.current[noteId]) {
        clearTimeout(debounceTimerRef.current[noteId]);
      }

      debounceTimerRef.current[noteId] = setTimeout(async () => {
        await saveNoteImmediate(noteId, updates);
        delete debounceTimerRef.current[noteId];
      }, 600);
    },
    [userId, activeNote, saveNoteImmediate]
  );

  // Delete note (to trash)
  const deleteNote = useCallback(
    async (id: string): Promise<void> => {
      await saveNoteImmediate(id, { is_deleted: true, is_pinned: false });
      if (activeNote?.id === id) {
        setIsEditorOpen(false);
        setActiveNote(null);
      }
    },
    [saveNoteImmediate, activeNote]
  );

  // Restore note from trash
  const restoreNote = useCallback(
    async (id: string): Promise<void> => {
      await saveNoteImmediate(id, { is_deleted: false });
    },
    [saveNoteImmediate]
  );

  // Permanent Delete
  const permanentDeleteNote = useCallback(
    async (id: string): Promise<void> => {
      setNotes((prev) => {
        const next = prev.filter((n) => n.id !== id);
        saveLocalNotes(userId, next);
        return next;
      });

      addToSyncQueue({
        id,
        action: 'DELETE_NOTE',
        payload: null,
      });

      if (activeNote?.id === id) {
        setIsEditorOpen(false);
        setActiveNote(null);
      }

      if (isConfigured && navigator.onLine) {
        await pushQueueToSupabase(userId);
      }
    },
    [userId, isConfigured, activeNote]
  );

  // Empty Trash
  const emptyTrash = useCallback(async (): Promise<void> => {
    const trashNoteIds = notes.filter((n) => n.is_deleted).map((n) => n.id);
    for (const id of trashNoteIds) {
      await permanentDeleteNote(id);
    }
  }, [notes, permanentDeleteNote]);

  // Toggle Pin
  const togglePin = useCallback(
    async (id: string): Promise<void> => {
      const note = notes.find((n) => n.id === id);
      if (!note) return;
      await saveNoteImmediate(id, { is_pinned: !note.is_pinned });
    },
    [notes, saveNoteImmediate]
  );

  // Toggle Archive
  const toggleArchive = useCallback(
    async (id: string): Promise<void> => {
      const note = notes.find((n) => n.id === id);
      if (!note) return;
      const willArchive = !note.is_archived;
      await saveNoteImmediate(id, {
        is_archived: willArchive,
        is_pinned: willArchive ? false : note.is_pinned,
      });
      if (activeNote?.id === id && willArchive) {
        setIsEditorOpen(false);
        setActiveNote(null);
      }
    },
    [notes, saveNoteImmediate, activeNote]
  );

  // Update note color
  const updateNoteColor = useCallback(
    async (id: string, color: NoteColor): Promise<void> => {
      await saveNoteImmediate(id, { color });
    },
    [saveNoteImmediate]
  );

  // Create Label
  const createLabel = useCallback(
    async (name: string, color = '#f59e0b'): Promise<Label> => {
      const trimmed = name.trim();
      const existing = labels.find((l) => l.name.toLowerCase() === trimmed.toLowerCase());
      if (existing) return existing;

      const newLabel: Label = {
        id: `lbl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        user_id: userId,
        name: trimmed,
        color,
        created_at: new Date().toISOString(),
      };

      setLabels((prev) => {
        const next = [...prev, newLabel];
        saveLocalLabels(userId, next);
        return next;
      });

      addToSyncQueue({
        id: newLabel.id,
        action: 'UPSERT_LABEL',
        payload: newLabel,
      });

      if (isConfigured && navigator.onLine) {
        pushQueueToSupabase(userId);
      }

      return newLabel;
    },
    [userId, labels, isConfigured]
  );

  // Delete Label
  const deleteLabel = useCallback(
    async (id: string): Promise<void> => {
      setLabels((prev) => {
        const next = prev.filter((l) => l.id !== id);
        saveLocalLabels(userId, next);
        return next;
      });

      setNotes((prev) => {
        const next = prev.map((n) => ({
          ...n,
          labels: (n.labels || []).filter((l) => l.id !== id),
        }));
        saveLocalNotes(userId, next);
        return next;
      });

      addToSyncQueue({
        id,
        action: 'DELETE_LABEL',
        payload: null,
      });

      if (isConfigured && navigator.onLine) {
        pushQueueToSupabase(userId);
      }
    },
    [userId, isConfigured]
  );

  // Toggle label on note
  const toggleNoteLabel = useCallback(
    async (noteId: string, label: Label): Promise<void> => {
      const note = notes.find((n) => n.id === noteId);
      if (!note) return;

      const existingLabels = note.labels || [];
      const hasLabel = existingLabels.some((l) => l.id === label.id);
      const newLabels = hasLabel
        ? existingLabels.filter((l) => l.id !== label.id)
        : [...existingLabels, label];

      await saveNoteImmediate(noteId, { labels: newLabels });
    },
    [notes, saveNoteImmediate]
  );

  // Version Snapshots
  const createVersionSnapshot = useCallback(
    async (note: Note, summary?: string): Promise<NoteVersion> => {
      return await createNoteVersionCheckpoint(note, summary);
    },
    []
  );

  const getVersionsForNote = useCallback(async (noteId: string): Promise<NoteVersion[]> => {
    return await getNoteVersionHistory(noteId);
  }, []);

  const restoreVersion = useCallback(
    async (noteId: string, version: NoteVersion): Promise<void> => {
      const current = notes.find((n) => n.id === noteId);
      if (current) {
        // Save current state as safety checkpoint before restoring older version
        await createNoteVersionCheckpoint(current, 'Pre-restore automatic checkpoint');
      }

      await saveNoteImmediate(noteId, {
        title: version.title,
        content: version.content,
        color: version.color,
        is_checklist: version.is_checklist,
        checklist_items: version.checklist_items,
      });
    },
    [notes, saveNoteImmediate]
  );

  // Execute Restore from Backup Payload
  const restoreFromBackupData = useCallback(
    async (rawPayload: any, options: RestoreOptions): Promise<RestoreResult> => {
      const result = await executeRestore(rawPayload, notes, labels, userId, options);
      if (result.success) {
        // Reload from local storage
        const { notes: reloadedNotes, labels: reloadedLabels } = await initializeOfflineStore(userId);
        setNotes(reloadedNotes);
        setLabels(reloadedLabels);

        // Queue sync to cloud
        if (isConfigured && navigator.onLine) {
          triggerSync();
        }
      }
      return result;
    },
    [notes, labels, userId, isConfigured, triggerSync]
  );

  return (
    <NotesContext.Provider
      value={{
        notes,
        labels,
        viewFilter,
        setViewFilter,
        searchQuery,
        setSearchQuery,
        syncState,
        syncStatusMessage,
        isOnline,
        isDatabaseConnected,
        databaseWarning,
        activeNote,
        setActiveNote,
        isEditorOpen,
        setIsEditorOpen,
        viewMode,
        setViewMode,
        createNote,
        saveNoteDebounced,
        saveNoteImmediate,
        deleteNote,
        restoreNote,
        permanentDeleteNote,
        emptyTrash,
        togglePin,
        toggleArchive,
        updateNoteColor,
        createLabel,
        deleteLabel,
        toggleNoteLabel,
        createVersionSnapshot,
        getVersionsForNote,
        restoreVersion,
        restoreFromBackupData,
        triggerSync,
      }}
    >
      {children}
    </NotesContext.Provider>
  );
}

export function useNotes() {
  const context = useContext(NotesContext);
  if (context === undefined) {
    throw new Error('useNotes must be used within a NotesProvider');
  }
  return context;
}
