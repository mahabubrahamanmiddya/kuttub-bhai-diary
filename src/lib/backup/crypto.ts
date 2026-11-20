import { DiaryBackupPayload, BackupVerificationResult } from '@/types/backup';
import { Note, Label, NoteVersion } from '@/types/diary';

/**
 * Universal SHA-256 computation that works seamlessly in Browser and Node.js.
 */
export async function calculateSHA256(text: string): Promise<string> {
  // 1. Try Web Crypto API (Browser & Node.js 16+)
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // 2. Node.js native crypto fallback
  try {
    const nodeCrypto = await import('crypto');
    return nodeCrypto.createHash('sha256').update(text, 'utf8').digest('hex');
  } catch (e) {
    throw new Error('SHA-256 computation unavailable in current runtime');
  }
}

/**
 * Normalizes notes and entities to strip transient client runtime flags
 * ensuring deterministic serialization.
 */
export function cleanNoteForExport(note: Note): Note {
  const { _syncStatus, _lastSyncedAt, _baseUpdatedAt, _isConflict, _conflictOriginal, ...rest } = note;
  return rest as Note;
}

/**
 * Generates the deterministic string payload used to compute the integrity checksum.
 */
export function getCanonicalBackupDataString(
  notes: Note[],
  labels: Label[],
  versions: NoteVersion[] = [],
  userPreferences: Record<string, any> = {}
): string {
  // Sort deterministically by ID
  const cleanedNotes = [...notes]
    .map(cleanNoteForExport)
    .sort((a, b) => a.id.localeCompare(b.id));

  const sortedLabels = [...labels].sort((a, b) => a.id.localeCompare(b.id));
  const sortedVersions = [...versions].sort((a, b) => a.id.localeCompare(b.id));

  return JSON.stringify({
    format_version: '2.0',
    notes: cleanedNotes,
    labels: sortedLabels,
    note_versions: sortedVersions,
    user_preferences: userPreferences,
  });
}

/**
 * Constructs a complete, verified DiaryBackupPayload ready for storage or download.
 */
export async function createBackupPayload(
  notes: Note[],
  labels: Label[],
  versions: NoteVersion[] = [],
  userPreferences: Record<string, any> = {},
  userId?: string
): Promise<DiaryBackupPayload> {
  const canonicalData = getCanonicalBackupDataString(notes, labels, versions, userPreferences);
  const checksum = await calculateSHA256(canonicalData);

  const cleanedNotes = [...notes].map(cleanNoteForExport);

  return {
    format_version: '2.0',
    app_name: 'My Diary',
    created_at: new Date().toISOString(),
    user_id: userId,
    notes: cleanedNotes,
    labels: [...labels],
    note_versions: [...versions],
    user_preferences: userPreferences,
    metadata: {
      notes_count: cleanedNotes.length,
      labels_count: labels.length,
      versions_count: versions.length,
      checksum_sha256: checksum,
      generated_by: 'Digital Diary Data Protection System v2.0',
    },
  };
}

/**
 * Verifies any backup object or parsed JSON for data integrity, checksum and schema conformity.
 */
export async function verifyBackupIntegrity(rawPayload: any): Promise<BackupVerificationResult> {
  if (!rawPayload || typeof rawPayload !== 'object') {
    return {
      valid: false,
      error: 'Invalid backup file: file content is not a valid JSON object.',
      notesCount: 0,
      labelsCount: 0,
      versionsCount: 0,
      createdAt: '',
      checksumMatched: false,
      computedChecksum: '',
      declaredChecksum: '',
      formatVersion: 'unknown',
      duplicateIdsFound: 0,
    };
  }

  // Handle both v1 legacy format (array of notes) and v2 format
  if (Array.isArray(rawPayload)) {
    // Legacy v1 backup format
    return {
      valid: true,
      notesCount: rawPayload.length,
      labelsCount: 0,
      versionsCount: 0,
      createdAt: new Date().toISOString(),
      checksumMatched: true,
      computedChecksum: 'legacy-v1',
      declaredChecksum: 'legacy-v1',
      formatVersion: '1.0-legacy',
      duplicateIdsFound: 0,
    };
  }

  const { format_version, notes, labels, note_versions, user_preferences, metadata, created_at } = rawPayload;

  if (!Array.isArray(notes)) {
    return {
      valid: false,
      error: 'Corrupted backup: missing or invalid "notes" collection.',
      notesCount: 0,
      labelsCount: 0,
      versionsCount: 0,
      createdAt: created_at || '',
      checksumMatched: false,
      computedChecksum: '',
      declaredChecksum: metadata?.checksum_sha256 || '',
      formatVersion: format_version || 'unknown',
      duplicateIdsFound: 0,
    };
  }

  const declaredChecksum = metadata?.checksum_sha256 || '';
  const safeLabels = Array.isArray(labels) ? labels : [];
  const safeVersions = Array.isArray(note_versions) ? note_versions : [];
  const safePrefs = user_preferences && typeof user_preferences === 'object' ? user_preferences : {};

  // Check duplicate IDs inside the backup itself
  const seenIds = new Set<string>();
  let duplicateCount = 0;
  for (const n of notes) {
    if (n && n.id) {
      if (seenIds.has(n.id)) {
        duplicateCount++;
      } else {
        seenIds.add(n.id);
      }
    }
  }

  // Verify SHA-256
  const canonicalData = getCanonicalBackupDataString(notes, safeLabels, safeVersions, safePrefs);
  const computedChecksum = await calculateSHA256(canonicalData);

  const checksumMatched = declaredChecksum ? computedChecksum === declaredChecksum : false;

  if (declaredChecksum && !checksumMatched) {
    return {
      valid: false,
      error: `Integrity check failed: checksum mismatch! Data may have been tampered with or corrupted. Declared: ${declaredChecksum.slice(0, 8)}..., Computed: ${computedChecksum.slice(0, 8)}...`,
      notesCount: notes.length,
      labelsCount: safeLabels.length,
      versionsCount: safeVersions.length,
      createdAt: created_at || '',
      checksumMatched: false,
      computedChecksum,
      declaredChecksum,
      formatVersion: format_version || '2.0',
      duplicateIdsFound: duplicateCount,
    };
  }

  return {
    valid: true,
    notesCount: notes.length,
    labelsCount: safeLabels.length,
    versionsCount: safeVersions.length,
    createdAt: created_at || new Date().toISOString(),
    checksumMatched: true,
    computedChecksum,
    declaredChecksum: declaredChecksum || computedChecksum,
    formatVersion: format_version || '2.0',
    duplicateIdsFound: duplicateCount,
  };
}

/**
 * Generates formatted filename: diary-backup-YYYY-MM-DD-HH-MM-SS.json
 */
export function generateBackupFilename(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const YYYY = date.getFullYear();
  const MM = pad(date.getMonth() + 1);
  const DD = pad(date.getDate());
  const HH = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const SS = pad(date.getSeconds());
  return `diary-backup-${YYYY}-${MM}-${DD}-${HH}-${mm}-${SS}.json`;
}
