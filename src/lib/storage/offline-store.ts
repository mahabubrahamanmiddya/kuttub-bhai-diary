import { Note, Label, NoteVersion } from '@/types/diary';
import {
  idbGetNotes,
  idbSaveNotes,
  idbUpsertNote,
  idbDeleteNote,
  idbGetLabels,
  idbSaveLabels,
  idbGetSyncQueue,
  idbAddToSyncQueue,
  idbRemoveFromSyncQueue,
  idbClearSyncQueue,
  idbSaveNoteVersion,
  idbGetNoteVersions,
  idbSaveBackupRecord,
  idbGetBackupHistory,
  idbGetMeta,
  idbSetMeta,
  SyncQueueItem,
} from './indexed-db';

export type { SyncQueueItem };

const OFFLINE_USER_ID_KEY = 'kuttub_diary_local_user_id';

// Default starter notes if the user starts fresh
export const getStarterNotes = (userId: string): Note[] => {
  const now = new Date().toISOString();
  return [
    {
      id: 'starter-note-welcome',
      user_id: userId,
      title: "Welcome to My Diary 📔",
      content: "Yeh aapki private digital diary hai. Yahan aap apna roz ka business hisaab, customer details, reminders aur personal notes aasaani se likh sakte hain.\n\n✨ Khoobiyan:\n• Likhte hi automatic save hota hai\n• Offline bhi kaam karta hai\n• Pinned notes sabse upar dikhte hain\n• Notes ko search kar sakte hain\n• Checklists aur reminders support karta hai\n• Google Drive aur Cloud backup se data hamesha mehfooz rehta hai",
      color: 'sand',
      is_pinned: true,
      is_archived: false,
      is_deleted: false,
      is_checklist: false,
      created_at: now,
      updated_at: now,
      labels: [{ id: 'lbl-important', user_id: userId, name: 'Important', color: '#F59E0B' }],
      _syncStatus: 'synced',
    },
    {
      id: 'starter-note-today-hisaab',
      user_id: userId,
      title: "Today's Business Hisaab",
      content: "19 November\n\nRaju - ₹5,000 lena hai\nSohail - ₹2,500 diya\nTransport - ₹300\nMarket se maal - ₹4,200\n\nKal Raju ko phone karna hai.",
      color: 'mint',
      is_pinned: true,
      is_archived: false,
      is_deleted: false,
      is_checklist: false,
      created_at: now,
      updated_at: now,
      labels: [{ id: 'lbl-business', user_id: userId, name: 'Business', color: '#3B82F6' }],
      _syncStatus: 'synced',
    },
    {
      id: 'starter-note-customer-list',
      user_id: userId,
      title: "Customer Contact List",
      content: "Raju Mistri - 9876543210 (Bandra Shop)\nSohail Bhai - 9823456781 (Advance ₹2500 received)\nRahul Hardware - 9765432109 (Supplier payment pending)",
      color: 'peach',
      is_pinned: false,
      is_archived: false,
      is_deleted: false,
      is_checklist: false,
      created_at: now,
      updated_at: now,
      labels: [{ id: 'lbl-customers', user_id: userId, name: 'Customers', color: '#10B981' }],
      _syncStatus: 'synced',
    },
    {
      id: 'starter-note-checklist',
      user_id: userId,
      title: "Tomorrow Tasks",
      content: "□ Call Raju about payment\n□ Bring packing material from market\n□ Pay supplier dues\n□ Check warehouse stock",
      color: 'sky',
      is_pinned: false,
      is_archived: false,
      is_deleted: false,
      is_checklist: true,
      checklist_items: [
        { id: 'item-1', text: 'Call Raju about payment', completed: false },
        { id: 'item-2', text: 'Bring packing material from market', completed: true },
        { id: 'item-3', text: 'Pay supplier dues', completed: false },
        { id: 'item-4', text: 'Check warehouse stock', completed: false },
      ],
      created_at: now,
      updated_at: now,
      labels: [{ id: 'lbl-business', user_id: userId, name: 'Business', color: '#3B82F6' }],
      _syncStatus: 'synced',
    },
  ];
};

export const getStarterLabels = (userId: string): Label[] => [
  { id: 'lbl-business', user_id: userId, name: 'Business', color: '#3B82F6' },
  { id: 'lbl-customers', user_id: userId, name: 'Customers', color: '#10B981' },
  { id: 'lbl-expenses', user_id: userId, name: 'Expenses', color: '#EF4444' },
  { id: 'lbl-personal', user_id: userId, name: 'Personal', color: '#8B5CF6' },
  { id: 'lbl-important', user_id: userId, name: 'Important', color: '#F59E0B' },
];

export const getLocalUserId = (): string => {
  if (typeof window === 'undefined') return 'local-user';
  let id = localStorage.getItem(OFFLINE_USER_ID_KEY);
  if (!id) {
    id = 'local-user-' + Math.random().toString(36).substring(2, 9);
    localStorage.setItem(OFFLINE_USER_ID_KEY, id);
  }
  return id;
};

// In-memory cache for synchronous instant rendering
const memoryCache: {
  notes: { [userId: string]: Note[] };
  labels: { [userId: string]: Label[] };
  queue: SyncQueueItem[];
} = {
  notes: {},
  labels: {},
  queue: [],
};

/**
 * Initializes and hydrates from IndexedDB with transparent fallback to localStorage
 */
export async function initializeOfflineStore(userId: string): Promise<{ notes: Note[]; labels: Label[] }> {
  try {
    let localNotes = await idbGetNotes(userId);
    let localLabels = await idbGetLabels(userId);

    // If IndexedDB empty, check legacy localStorage
    if (localNotes.length === 0 && typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(`kuttub_diary_notes_v1_${userId}`);
        if (raw) {
          localNotes = JSON.parse(raw);
          // Migrate to IndexedDB
          await idbSaveNotes(userId, localNotes);
        }
      } catch {}
    }

    if (localLabels.length === 0 && typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(`kuttub_diary_labels_v1_${userId}`);
        if (raw) {
          localLabels = JSON.parse(raw);
          await idbSaveLabels(userId, localLabels);
        }
      } catch {}
    }

    // If still empty, provision starter notes
    if (localNotes.length === 0) {
      localNotes = getStarterNotes(userId);
      await idbSaveNotes(userId, localNotes);
    }
    if (localLabels.length === 0) {
      localLabels = getStarterLabels(userId);
      await idbSaveLabels(userId, localLabels);
    }

    memoryCache.notes[userId] = localNotes;
    memoryCache.labels[userId] = localLabels;
    memoryCache.queue = await idbGetSyncQueue();

    return { notes: localNotes, labels: localLabels };
  } catch (e) {
    console.error('Failed to initialize IndexedDB offline store:', e);
    const starters = getStarterNotes(userId);
    const starterLabels = getStarterLabels(userId);
    memoryCache.notes[userId] = starters;
    memoryCache.labels[userId] = starterLabels;
    return { notes: starters, labels: starterLabels };
  }
}

// Synchronous getter for instant UI (uses memory cache)
export const loadLocalNotes = (userId: string): Note[] => {
  if (memoryCache.notes[userId]) {
    return memoryCache.notes[userId];
  }
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`kuttub_diary_notes_v1_${userId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      memoryCache.notes[userId] = parsed;
      return parsed;
    }
  } catch {}
  const starters = getStarterNotes(userId);
  memoryCache.notes[userId] = starters;
  return starters;
};

// Asynchronous persistent note saving into IndexedDB
export const saveLocalNotes = (userId: string, notes: Note[]): void => {
  memoryCache.notes[userId] = notes;
  // Save to IndexedDB (asynchronously) and localStorage fallback
  idbSaveNotes(userId, notes).catch((err) => console.error('Error saving to IDB:', err));
};

export const loadLocalLabels = (userId: string): Label[] => {
  if (memoryCache.labels[userId]) {
    return memoryCache.labels[userId];
  }
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`kuttub_diary_labels_v1_${userId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      memoryCache.labels[userId] = parsed;
      return parsed;
    }
  } catch {}
  const starters = getStarterLabels(userId);
  memoryCache.labels[userId] = starters;
  return starters;
};

export const saveLocalLabels = (userId: string, labels: Label[]): void => {
  memoryCache.labels[userId] = labels;
  idbSaveLabels(userId, labels).catch((err) => console.error('Error saving labels to IDB:', err));
};

export const loadSyncQueue = (): SyncQueueItem[] => {
  if (memoryCache.queue && memoryCache.queue.length > 0) {
    return memoryCache.queue;
  }
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('kuttub_diary_sync_queue_v1');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const saveSyncQueue = (queue: SyncQueueItem[]): void => {
  memoryCache.queue = queue;
  try {
    localStorage.setItem('kuttub_diary_sync_queue_v1', JSON.stringify(queue));
  } catch {}
};

export const addToSyncQueue = (item: Omit<SyncQueueItem, 'timestamp'>): void => {
  const current = loadSyncQueue();
  const filtered = current.filter((q) => !(q.id === item.id && q.action === item.action));
  const fullItem: SyncQueueItem = { ...item, timestamp: Date.now() };
  filtered.push(fullItem);
  saveSyncQueue(filtered);
  idbAddToSyncQueue(item).catch(() => {});
};

export const clearQueueItem = (id: string, action: string): void => {
  const current = loadSyncQueue();
  const next = current.filter((q) => !(q.id === id && q.action === action));
  saveSyncQueue(next);
  idbRemoveFromSyncQueue(id, action).catch(() => {});
};

// Re-export IndexedDB version & queue methods
export {
  idbSaveNoteVersion,
  idbGetNoteVersions,
  idbSaveBackupRecord,
  idbGetBackupHistory,
  idbRemoveFromSyncQueue,
  idbClearSyncQueue,
};
