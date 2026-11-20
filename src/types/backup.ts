import { Note, Label, NoteVersion } from './diary';

export interface BackupMetadataRecord {
  id: string;
  filename: string;
  storage_location: 'google_drive' | 'local_download' | 'github_actions' | 'manual_export';
  file_size_bytes: number;
  notes_count: number;
  labels_count: number;
  checksum_sha256: string;
  status: 'verified' | 'success' | 'failed';
  drive_file_id?: string;
  created_at: string;
  details?: Record<string, any>;
}

export interface DiaryBackupPayload {
  format_version: '2.0';
  app_name: 'My Diary';
  created_at: string;
  user_id?: string;
  notes: Note[];
  labels: Label[];
  note_versions?: NoteVersion[];
  user_preferences?: Record<string, any>;
  metadata: {
    notes_count: number;
    labels_count: number;
    versions_count: number;
    checksum_sha256: string;
    generated_by: string;
  };
}

export interface BackupVerificationResult {
  valid: boolean;
  error?: string;
  notesCount: number;
  labelsCount: number;
  versionsCount: number;
  createdAt: string;
  checksumMatched: boolean;
  computedChecksum: string;
  declaredChecksum: string;
  formatVersion: string;
  duplicateIdsFound: number;
}

export type RestoreMode = 'merge' | 'replace';

export interface RestoreOptions {
  mode: RestoreMode;
  createSafetyBackup?: boolean;
}

export interface RestoreResult {
  success: boolean;
  error?: string;
  restoredNotesCount: number;
  restoredLabelsCount: number;
  restoredVersionsCount: number;
  safetyBackupCreated?: boolean;
  safetyBackupFilename?: string;
  mode: RestoreMode;
}
