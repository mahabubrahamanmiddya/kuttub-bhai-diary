export type NoteColor =
  | 'default'
  | 'sand'
  | 'peach'
  | 'coral'
  | 'mint'
  | 'sage'
  | 'sky'
  | 'lavender'
  | 'clay';

export interface NoteColorConfig {
  id: NoteColor;
  name: string;
  bgLight: string;
  bgDark: string;
  borderLight: string;
  borderDark: string;
}

export const NOTE_COLORS: Record<NoteColor, NoteColorConfig> = {
  default: {
    id: 'default',
    name: 'Default',
    bgLight: 'bg-white',
    bgDark: 'dark:bg-stone-800',
    borderLight: 'border-stone-200',
    borderDark: 'dark:border-stone-700',
  },
  sand: {
    id: 'sand',
    name: 'Warm Sand',
    bgLight: 'bg-amber-50',
    bgDark: 'dark:bg-amber-950/40',
    borderLight: 'border-amber-200',
    borderDark: 'dark:border-amber-800/50',
  },
  peach: {
    id: 'peach',
    name: 'Peach',
    bgLight: 'bg-orange-50',
    bgDark: 'dark:bg-orange-950/40',
    borderLight: 'border-orange-200',
    borderDark: 'dark:border-orange-800/50',
  },
  coral: {
    id: 'coral',
    name: 'Coral',
    bgLight: 'bg-rose-50',
    bgDark: 'dark:bg-rose-950/40',
    borderLight: 'border-rose-200',
    borderDark: 'dark:border-rose-800/50',
  },
  mint: {
    id: 'mint',
    name: 'Mint',
    bgLight: 'bg-emerald-50',
    bgDark: 'dark:bg-emerald-950/40',
    borderLight: 'border-emerald-200',
    borderDark: 'dark:border-emerald-800/50',
  },
  sage: {
    id: 'sage',
    name: 'Sage',
    bgLight: 'bg-teal-50',
    bgDark: 'dark:bg-teal-950/40',
    borderLight: 'border-teal-200',
    borderDark: 'dark:border-teal-800/50',
  },
  sky: {
    id: 'sky',
    name: 'Sky Blue',
    bgLight: 'bg-sky-50',
    bgDark: 'dark:bg-sky-950/40',
    borderLight: 'border-sky-200',
    borderDark: 'dark:border-sky-800/50',
  },
  lavender: {
    id: 'lavender',
    name: 'Lavender',
    bgLight: 'bg-purple-50',
    bgDark: 'dark:bg-purple-950/40',
    borderLight: 'border-purple-200',
    borderDark: 'dark:border-purple-800/50',
  },
  clay: {
    id: 'clay',
    name: 'Clay',
    bgLight: 'bg-stone-100',
    bgDark: 'dark:bg-stone-900',
    borderLight: 'border-stone-300',
    borderDark: 'dark:border-stone-700',
  },
};

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface Label {
  id: string;
  user_id: string;
  name: string;
  color?: string;
  created_at?: string;
}

export interface NoteVersion {
  id: string;
  note_id: string;
  user_id: string;
  title: string;
  content: string;
  color: NoteColor;
  is_checklist: boolean;
  checklist_items?: ChecklistItem[];
  version_number: number;
  change_summary?: string;
  created_at: string;
}

export interface Note {
  id: string;
  user_id: string;
  title: string;
  content: string;
  color: NoteColor;
  is_pinned: boolean;
  is_archived: boolean;
  is_deleted: boolean;
  is_checklist?: boolean;
  checklist_items?: ChecklistItem[];
  reminder_date?: string | null;
  labels?: Label[];
  created_at: string;
  updated_at: string;
  // Synchronization & Conflict metadata
  _syncStatus?: 'synced' | 'pending' | 'conflict';
  _lastSyncedAt?: string;
  _baseUpdatedAt?: string;
  _isConflict?: boolean;
  _conflictOriginal?: Partial<Note>;
}

export type ViewFilter = 'notes' | 'pinned' | 'archive' | 'trash' | { labelId: string; labelName: string };

export type SyncState =
  | 'idle'
  | 'saving'
  | 'saved_device'
  | 'waiting_sync'
  | 'saved_cloud'
  | 'offline'
  | 'sync_failed'
  | 'error';
