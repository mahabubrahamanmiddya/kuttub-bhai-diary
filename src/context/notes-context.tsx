'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Note, Label, ViewFilter, SyncState, NoteColor } from '@/types/diary';
import { useAuth } from './auth-context';
import {
  loadLocalNotes,
  saveLocalNotes,
  loadLocalLabels,
  saveLocalLabels,
  addToSyncQueue,
  loadSyncQueue,
} from '@/lib/storage/offline-store';
import { pushQueueToSupabase, fetchAllFromSupabase } from '@/lib/storage/sync-engine';
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

  // Manual Trigger
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
  const [syncStatusMessage, setSyncStatusMessage] = useState<string>('');
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Debounce ref
  const debounceTimerRef = useRef<{ [key: string]: NodeJS.Timeout }>({});

  // Online / Offline listeners
  useEffect(() => {
    setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);

    const handleOnline = () => {
      setIsOnline(true);
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
  }, [userId, isConfigured]);

  // Load initial notes from local storage immediately (0ms instant startup)
  useEffect(() => {
    const localNotes = loadLocalNotes(userId);
    const localLabels = loadLocalLabels(userId);
    setNotes(localNotes);
    setLabels(localLabels);

    // Initial background sync with Supabase if configured & online
    if (isConfigured && navigator.onLine) {
      triggerSync();
    }
  }, [userId, isConfigured]);

  // Sync execution
  const triggerSync = useCallback(async () => {
    if (!navigator.onLine) {
      setSyncState('offline');
      setSyncStatusMessage("Offline — changes will sync when you're back online");
      return;
    }

    if (!isConfigured) {
      // Local demo mode: everything is stored cleanly in local persistence
      setSyncState('saved');
      setSyncStatusMessage('Saved ✓');
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

      if (remoteData) {
        // Merge notes: keep any local notes that have pending queue items
        const currentQueue = loadSyncQueue();
        const pendingNoteIds = new Set(
          currentQueue.filter((q) => q.action === 'UPSERT_NOTE').map((q) => q.id)
        );

        setNotes((prevLocalNotes) => {
          const merged = [...remoteData.notes];
          // If a note was modified locally and is pending push, keep the local version
          prevLocalNotes.forEach((localNote) => {
            if (pendingNoteIds.has(localNote.id)) {
              const idx = merged.findIndex((m) => m.id === localNote.id);
              if (idx !== -1) {
                merged[idx] = localNote;
              } else {
                merged.unshift(localNote);
              }
            }
          });
          saveLocalNotes(userId, merged);
          return merged;
        });

        if (remoteData.labels.length > 0) {
          setLabels(remoteData.labels);
          saveLocalLabels(userId, remoteData.labels);
        }
      }

      setSyncState('saved_cloud');
      setSyncStatusMessage('Saved to cloud ✓');
      setTimeout(() => {
        setSyncState('idle');
      }, 3000);
    } catch (e) {
      console.error('Sync failed:', e);
      setSyncState('error');
      setSyncStatusMessage('Sync error');
    }
  }, [userId, isConfigured]);

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
      };

      setNotes((prev) => {
        const next = [newNote, ...prev];
        saveLocalNotes(userId, next);
        return next;
      });

      // Queue for Supabase sync
      addToSyncQueue({
        id: newNote.id,
        action: 'UPSERT_NOTE',
        payload: newNote,
      });

      if (!navigator.onLine) {
        setSyncState('offline');
        setSyncStatusMessage("Offline — changes will sync when you're back online");
      } else if (isConfigured) {
        setSyncState('saving');
        setSyncStatusMessage('Saving...');
        // Sync in background
        pushQueueToSupabase(userId).then((res) => {
          if (res.success) {
            setSyncState('saved_cloud');
            setSyncStatusMessage('Saved to cloud ✓');
            setTimeout(() => setSyncState('idle'), 2500);
          }
        });
      } else {
        setSyncState('saved');
        setSyncStatusMessage('Saved ✓');
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
          setSyncState('offline');
          setSyncStatusMessage("Offline — changes will sync when you're back online");
        } else if (isConfigured) {
          setSyncState('saving');
          setSyncStatusMessage('Saving...');
          const res = await pushQueueToSupabase(userId);
          if (res.success) {
            setSyncState('saved_cloud');
            setSyncStatusMessage('Saved to cloud ✓');
            setTimeout(() => setSyncState('idle'), 2500);
          }
        } else {
          setSyncState('saved');
          setSyncStatusMessage('Saved ✓');
          setTimeout(() => setSyncState('idle'), 2000);
        }
      }
    },
    [userId, isConfigured, activeNote]
  );

  // Debounced auto-save while typing in Keep Notes style editor
  const saveNoteDebounced = useCallback(
    async (noteId: string, updates: Partial<Note>): Promise<void> => {
      // Show "Saving..." indicator immediately on keystroke
      setSyncState('saving');
      setSyncStatusMessage('Saving...');

      // Optimistically update in state so UI is instant
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

      // Clear existing debounce timer for this note
      if (debounceTimerRef.current[noteId]) {
        clearTimeout(debounceTimerRef.current[noteId]);
      }

      // Debounce saving to cloud / storage by 600ms
      debounceTimerRef.current[noteId] = setTimeout(async () => {
        await saveNoteImmediate(noteId, updates);
        delete debounceTimerRef.current[noteId];
      }, 600);
    },
    [userId, activeNote, saveNoteImmediate]
  );

  // Delete note (move to trash)
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

      // Remove this label from all notes locally
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
