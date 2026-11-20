import { Note, Label, NoteVersion } from '@/types/diary';
import { BackupMetadataRecord } from '@/types/backup';

const DB_NAME = 'DigitalDiaryDB_v2';
const DB_VERSION = 1;

export interface SyncQueueItem {
  id: string;
  action: 'UPSERT_NOTE' | 'DELETE_NOTE' | 'UPSERT_LABEL' | 'DELETE_LABEL' | 'SET_NOTE_LABELS';
  payload: any;
  timestamp: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function isIndexedDBSupported(): boolean {
  return typeof window !== 'undefined' && 'indexedDB' in window && window.indexedDB !== null;
}

function openDB(): Promise<IDBDatabase> {
  if (!isIndexedDBSupported()) {
    return Promise.reject(new Error('IndexedDB is not supported in this environment'));
  }

  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = request.result;

        // 1. Notes Store
        if (!db.objectStoreNames.contains('notes')) {
          const notesStore = db.createObjectStore('notes', { keyPath: 'id' });
          notesStore.createIndex('user_id', 'user_id', { unique: false });
          notesStore.createIndex('updated_at', 'updated_at', { unique: false });
          notesStore.createIndex('is_pinned', 'is_pinned', { unique: false });
          notesStore.createIndex('is_archived', 'is_archived', { unique: false });
          notesStore.createIndex('is_deleted', 'is_deleted', { unique: false });
        }

        // 2. Note Versions Store
        if (!db.objectStoreNames.contains('note_versions')) {
          const versionsStore = db.createObjectStore('note_versions', { keyPath: 'id' });
          versionsStore.createIndex('note_id', 'note_id', { unique: false });
          versionsStore.createIndex('created_at', 'created_at', { unique: false });
        }

        // 3. Labels Store
        if (!db.objectStoreNames.contains('labels')) {
          const labelsStore = db.createObjectStore('labels', { keyPath: 'id' });
          labelsStore.createIndex('user_id', 'user_id', { unique: false });
        }

        // 4. Sync Queue Store
        if (!db.objectStoreNames.contains('sync_queue')) {
          const queueStore = db.createObjectStore('sync_queue', { keyPath: 'id' });
          queueStore.createIndex('timestamp', 'timestamp', { unique: false });
          queueStore.createIndex('action', 'action', { unique: false });
        }

        // 5. Backup History Store
        if (!db.objectStoreNames.contains('backup_history')) {
          const backupsStore = db.createObjectStore('backup_history', { keyPath: 'id' });
          backupsStore.createIndex('created_at', 'created_at', { unique: false });
        }

        // 6. App Metadata Store
        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata', { keyPath: 'key' });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    } catch (e) {
      reject(e);
    }
  });

  return dbPromise;
}

// ==========================================
// NOTES REPOSITORY
// ==========================================

export async function idbGetNotes(userId: string): Promise<Note[]> {
  if (!isIndexedDBSupported()) {
    return loadFallbackNotes(userId);
  }
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('notes', 'readonly');
      const store = tx.objectStore('notes');
      const request = store.getAll();

      request.onsuccess = () => {
        const allNotes: Note[] = request.result || [];
        // Filter by user_id if multiple users on same machine, or return all local notes
        const filtered = allNotes.filter((n) => !n.user_id || n.user_id === userId);
        resolve(filtered);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.warn('Falling back to localStorage for getNotes:', e);
    return loadFallbackNotes(userId);
  }
}

export async function idbSaveNotes(userId: string, notes: Note[]): Promise<void> {
  // Always mirror to localStorage as backup layer
  saveFallbackNotes(userId, notes);

  if (!isIndexedDBSupported()) return;
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('notes', 'readwrite');
      const store = tx.objectStore('notes');

      // Clear existing user notes in store and put updated ones
      for (const note of notes) {
        store.put(note);
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn('Failed to save notes in IndexedDB:', e);
  }
}

export async function idbUpsertNote(note: Note): Promise<void> {
  if (!isIndexedDBSupported()) return;
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('notes', 'readwrite');
      const store = tx.objectStore('notes');
      store.put(note);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn('Failed to upsert note in IndexedDB:', e);
  }
}

export async function idbDeleteNote(id: string): Promise<void> {
  if (!isIndexedDBSupported()) return;
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('notes', 'readwrite');
      const store = tx.objectStore('notes');
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn('Failed to delete note from IndexedDB:', e);
  }
}

// ==========================================
// NOTE VERSIONS REPOSITORY
// ==========================================

export async function idbSaveNoteVersion(version: NoteVersion): Promise<void> {
  if (!isIndexedDBSupported()) return;
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('note_versions', 'readwrite');
      const store = tx.objectStore('note_versions');
      store.put(version);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn('Failed to save note version in IndexedDB:', e);
  }
}

export async function idbGetNoteVersions(noteId: string): Promise<NoteVersion[]> {
  if (!isIndexedDBSupported()) return [];
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('note_versions', 'readonly');
      const store = tx.objectStore('note_versions');
      const index = store.index('note_id');
      const request = index.getAll(noteId);

      request.onsuccess = () => {
        const versions: NoteVersion[] = request.result || [];
        versions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        resolve(versions);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.warn('Failed to get note versions from IndexedDB:', e);
    return [];
  }
}

// ==========================================
// LABELS REPOSITORY
// ==========================================

export async function idbGetLabels(userId: string): Promise<Label[]> {
  if (!isIndexedDBSupported()) {
    return loadFallbackLabels(userId);
  }
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('labels', 'readonly');
      const store = tx.objectStore('labels');
      const request = store.getAll();

      request.onsuccess = () => {
        const allLabels: Label[] = request.result || [];
        const filtered = allLabels.filter((l) => !l.user_id || l.user_id === userId);
        resolve(filtered);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    return loadFallbackLabels(userId);
  }
}

export async function idbSaveLabels(userId: string, labels: Label[]): Promise<void> {
  saveFallbackLabels(userId, labels);
  if (!isIndexedDBSupported()) return;
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('labels', 'readwrite');
      const store = tx.objectStore('labels');
      for (const label of labels) {
        store.put(label);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn('Failed to save labels in IndexedDB:', e);
  }
}

// ==========================================
// SYNC QUEUE REPOSITORY
// ==========================================

export async function idbGetSyncQueue(): Promise<SyncQueueItem[]> {
  if (!isIndexedDBSupported()) {
    return loadFallbackQueue();
  }
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sync_queue', 'readonly');
      const store = tx.objectStore('sync_queue');
      const request = store.getAll();

      request.onsuccess = () => {
        const queue: SyncQueueItem[] = request.result || [];
        queue.sort((a, b) => a.timestamp - b.timestamp);
        resolve(queue);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    return loadFallbackQueue();
  }
}

export async function idbAddToSyncQueue(item: Omit<SyncQueueItem, 'timestamp'>): Promise<void> {
  const fullItem: SyncQueueItem = { ...item, timestamp: Date.now() };
  addToFallbackQueue(fullItem);

  if (!isIndexedDBSupported()) return;
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sync_queue', 'readwrite');
      const store = tx.objectStore('sync_queue');
      store.put(fullItem);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn('Failed to add to sync queue in IndexedDB:', e);
  }
}

export async function idbRemoveFromSyncQueue(id: string, action: string): Promise<void> {
  removeFromFallbackQueue(id, action);
  if (!isIndexedDBSupported()) return;
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sync_queue', 'readwrite');
      const store = tx.objectStore('sync_queue');
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn('Failed to remove from sync queue in IndexedDB:', e);
  }
}

export async function idbClearSyncQueue(): Promise<void> {
  clearFallbackQueue();
  if (!isIndexedDBSupported()) return;
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sync_queue', 'readwrite');
      const store = tx.objectStore('sync_queue');
      store.clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn('Failed to clear sync queue in IndexedDB:', e);
  }
}

// ==========================================
// BACKUP HISTORY REPOSITORY
// ==========================================

export async function idbSaveBackupRecord(record: BackupMetadataRecord): Promise<void> {
  if (!isIndexedDBSupported()) return;
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('backup_history', 'readwrite');
      const store = tx.objectStore('backup_history');
      store.put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn('Failed to save backup record in IndexedDB:', e);
  }
}

export async function idbGetBackupHistory(): Promise<BackupMetadataRecord[]> {
  if (!isIndexedDBSupported()) return [];
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('backup_history', 'readonly');
      const store = tx.objectStore('backup_history');
      const request = store.getAll();

      request.onsuccess = () => {
        const records: BackupMetadataRecord[] = request.result || [];
        records.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        resolve(records);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    return [];
  }
}

// ==========================================
// METADATA STORE (User preferences, last sync)
// ==========================================

export async function idbGetMeta<T = any>(key: string): Promise<T | null> {
  if (!isIndexedDBSupported()) {
    try {
      const raw = localStorage.getItem(`kuttub_meta_${key}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('metadata', 'readonly');
      const store = tx.objectStore('metadata');
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result?.value ?? null);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return null;
  }
}

export async function idbSetMeta(key: string, value: any): Promise<void> {
  try {
    localStorage.setItem(`kuttub_meta_${key}`, JSON.stringify(value));
  } catch {}
  if (!isIndexedDBSupported()) return;
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('metadata', 'readwrite');
      const store = tx.objectStore('metadata');
      store.put({ key, value });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {}
}

// ==========================================
// LOCALSTORAGE FALLBACK ENGINE
// ==========================================

function loadFallbackNotes(userId: string): Note[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`kuttub_diary_notes_v1_${userId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveFallbackNotes(userId: string, notes: Note[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`kuttub_diary_notes_v1_${userId}`, JSON.stringify(notes));
  } catch {}
}

function loadFallbackLabels(userId: string): Label[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`kuttub_diary_labels_v1_${userId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveFallbackLabels(userId: string, labels: Label[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`kuttub_diary_labels_v1_${userId}`, JSON.stringify(labels));
  } catch {}
}

function loadFallbackQueue(): SyncQueueItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('kuttub_diary_sync_queue_v1');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function addToFallbackQueue(item: SyncQueueItem): void {
  const queue = loadFallbackQueue();
  const filtered = queue.filter((q) => !(q.id === item.id && q.action === item.action));
  filtered.push(item);
  try {
    localStorage.setItem('kuttub_diary_sync_queue_v1', JSON.stringify(filtered));
  } catch {}
}

function removeFromFallbackQueue(id: string, action: string): void {
  const queue = loadFallbackQueue();
  const filtered = queue.filter((q) => !(q.id === id && q.action === action));
  try {
    localStorage.setItem('kuttub_diary_sync_queue_v1', JSON.stringify(filtered));
  } catch {}
}

function clearFallbackQueue(): void {
  try {
    localStorage.removeItem('kuttub_diary_sync_queue_v1');
  } catch {}
}
