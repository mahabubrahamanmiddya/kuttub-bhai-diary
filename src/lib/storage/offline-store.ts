import { Note, Label } from '@/types/diary';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/client';

const STORAGE_KEYS = {
  NOTES: 'kuttub_diary_notes_v1',
  LABELS: 'kuttub_diary_labels_v1',
  QUEUE: 'kuttub_diary_sync_queue_v1',
  LAST_SYNC: 'kuttub_diary_last_sync_v1',
  OFFLINE_USER_ID: 'kuttub_diary_local_user_id',
};

export interface SyncQueueItem {
  id: string;
  action: 'UPSERT_NOTE' | 'DELETE_NOTE' | 'UPSERT_LABEL' | 'DELETE_LABEL' | 'SET_NOTE_LABELS';
  payload: any;
  timestamp: number;
}

// Default starter notes if the user starts fresh
export const getStarterNotes = (userId: string): Note[] => {
  const now = new Date().toISOString();
  return [
    {
      id: 'starter-note-welcome',
      user_id: userId,
      title: "Welcome to My Diary 📔",
      content: "Yeh aapki private digital diary hai. Yahan aap apna roz ka business hisaab, customer details, reminders aur personal notes aasaani se likh sakte hain.\n\n✨ Khoobiyan:\n• Likhte hi automatic save hota hai\n• Offline bhi kaam karta hai\n• Pinned notes sabse upar dikhte hain\n• Notes ko search kar sakte hain\n• Checklists aur reminders support karta hai",
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
  let id = localStorage.getItem(STORAGE_KEYS.OFFLINE_USER_ID);
  if (!id) {
    id = 'local-user-' + Math.random().toString(36).substring(2, 9);
    localStorage.setItem(STORAGE_KEYS.OFFLINE_USER_ID, id);
  }
  return id;
};

// Safe localStorage helpers
export const loadLocalNotes = (userId: string): Note[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`${STORAGE_KEYS.NOTES}_${userId}`);
    if (!raw) {
      const starters = getStarterNotes(userId);
      saveLocalNotes(userId, starters);
      return starters;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load local notes:', e);
    return [];
  }
};

export const saveLocalNotes = (userId: string, notes: Note[]): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${STORAGE_KEYS.NOTES}_${userId}`, JSON.stringify(notes));
  } catch (e) {
    console.error('Failed to save local notes:', e);
  }
};

export const loadLocalLabels = (userId: string): Label[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`${STORAGE_KEYS.LABELS}_${userId}`);
    if (!raw) {
      const starters = getStarterLabels(userId);
      saveLocalLabels(userId, starters);
      return starters;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load local labels:', e);
    return [];
  }
};

export const saveLocalLabels = (userId: string, labels: Label[]): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${STORAGE_KEYS.LABELS}_${userId}`, JSON.stringify(labels));
  } catch (e) {
    console.error('Failed to save local labels:', e);
  }
};

export const loadSyncQueue = (): SyncQueueItem[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.QUEUE);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
};

export const saveSyncQueue = (queue: SyncQueueItem[]): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.QUEUE, JSON.stringify(queue));
  } catch (e) {}
};

export const addToSyncQueue = (item: Omit<SyncQueueItem, 'timestamp'>): void => {
  const queue = loadSyncQueue();
  // If an operation on the same item already exists, merge or deduplicate
  const filtered = queue.filter((q) => !(q.id === item.id && q.action === item.action));
  filtered.push({ ...item, timestamp: Date.now() });
  saveSyncQueue(filtered);
};

export const clearQueueItem = (id: string, action: string): void => {
  const queue = loadSyncQueue();
  saveSyncQueue(queue.filter((q) => !(q.id === id && q.action === action)));
};
