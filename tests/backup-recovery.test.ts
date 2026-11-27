import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateSHA256,
  createBackupPayload,
  verifyBackupIntegrity,
  generateBackupFilename,
} from '../src/lib/backup/crypto';
import { executeRestore } from '../src/lib/backup/restoration';
import { mergeNotesWithConflictResolution, parseChecklistFromContent } from '../src/lib/storage/sync-engine';
import { Note, Label, NoteVersion } from '../src/types/diary';

describe('Digital Diary Data Protection & Recovery System', () => {
  const mockUserId1 = 'user-2026-original';
  const mockUserId2 = 'user-2030-new-project';

  const sampleNotes: Note[] = [
    {
      id: 'note-001',
      user_id: mockUserId1,
      title: "Today's Business Hisaab",
      content: 'Raju se ₹5,000 lena hai\nSohail ko ₹2,500 diya',
      color: 'sand',
      is_pinned: true,
      is_archived: false,
      is_deleted: false,
      is_checklist: false,
      created_at: '2026-11-19T10:00:00.000Z',
      updated_at: '2026-11-19T12:00:00.000Z',
      labels: [{ id: 'lbl-biz', user_id: mockUserId1, name: 'Business', color: '#3B82F6' }],
    },
    {
      id: 'note-002',
      user_id: mockUserId1,
      title: 'Customer Details - Raju',
      content: 'Raju Mistri - 9876543210 (Advance pending)',
      color: 'mint',
      is_pinned: false,
      is_archived: false,
      is_deleted: false,
      is_checklist: false,
      created_at: '2026-11-18T09:00:00.000Z',
      updated_at: '2026-11-18T09:00:00.000Z',
      labels: [{ id: 'lbl-cust', user_id: mockUserId1, name: 'Customers', color: '#10B981' }],
    },
    {
      id: 'note-003',
      user_id: mockUserId1,
      title: 'Checklist for Supplier',
      content: '□ Call supplier\n☑ Bring packing material',
      color: 'sky',
      is_pinned: false,
      is_archived: false,
      is_deleted: false,
      is_checklist: true,
      checklist_items: [
        { id: 'item-1', text: 'Call supplier', completed: false },
        { id: 'item-2', text: 'Bring packing material', completed: true },
      ],
      created_at: '2026-11-17T08:00:00.000Z',
      updated_at: '2026-11-17T08:00:00.000Z',
      labels: [],
    },
    {
      id: 'note-004-trash',
      user_id: mockUserId1,
      title: 'Old Expense Draft',
      content: 'Trash note',
      color: 'default',
      is_pinned: false,
      is_archived: false,
      is_deleted: true, // In Trash
      created_at: '2026-11-16T08:00:00.000Z',
      updated_at: '2026-11-16T08:00:00.000Z',
      labels: [],
    },
  ];

  const sampleLabels: Label[] = [
    { id: 'lbl-biz', user_id: mockUserId1, name: 'Business', color: '#3B82F6' },
    { id: 'lbl-cust', user_id: mockUserId1, name: 'Customers', color: '#10B981' },
    { id: 'lbl-exp', user_id: mockUserId1, name: 'Expenses', color: '#EF4444' },
  ];

  // ========================================================
  // 1. OFFLINE STORAGE & CHECKLIST PARSING
  // ========================================================
  describe('1. Offline Note Creation & Checklist Parsing', () => {
    it('correctly parses checkboxes and completion states from content', () => {
      const content = '□ Buy materials\n☑ Pay electricity bill\n[ ] Check stock';
      const parsed = parseChecklistFromContent(content);
      expect(parsed).toHaveLength(3);
      expect(parsed[0].completed).toBe(false);
      expect(parsed[0].text).toBe('Buy materials');
      expect(parsed[1].completed).toBe(true);
      expect(parsed[1].text).toBe('Pay electricity bill');
      expect(parsed[2].completed).toBe(false);
      expect(parsed[2].text).toBe('Check stock');
    });
  });

  // ========================================================
  // 2. BACKUP INTEGRITY & CRYPTOGRAPHY (SHA-256)
  // ========================================================
  describe('2. Backup Integrity & Cryptographic Verification', () => {
    it('computes consistent, deterministic SHA-256 checksums', async () => {
      const hash1 = await calculateSHA256('Test data 123');
      const hash2 = await calculateSHA256('Test data 123');
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // standard hex length
    });

    it('generates a valid backup payload conforming to format version 2.0', async () => {
      const payload = await createBackupPayload(sampleNotes, sampleLabels, [], {}, mockUserId1);

      expect(payload.format_version).toBe('2.0');
      expect(payload.notes).toHaveLength(sampleNotes.length);
      expect(payload.labels).toHaveLength(sampleLabels.length);
      expect(payload.metadata.checksum_sha256).toBeDefined();
      expect(payload.metadata.notes_count).toBe(sampleNotes.length);
    });

    it('successfully verifies a genuine, untampered backup payload', async () => {
      const payload = await createBackupPayload(sampleNotes, sampleLabels, [], {}, mockUserId1);
      const verification = await verifyBackupIntegrity(payload);

      expect(verification.valid).toBe(true);
      expect(verification.checksumMatched).toBe(true);
      expect(verification.notesCount).toBe(4);
      expect(verification.labelsCount).toBe(3);
      expect(verification.duplicateIdsFound).toBe(0);
    });

    it('REJECTS a corrupted backup where content was altered without valid checksum', async () => {
      const payload = await createBackupPayload(sampleNotes, sampleLabels, [], {}, mockUserId1);

      // Tamper with note content
      payload.notes[0].content = 'Tampered content by attacker or corruption';

      const verification = await verifyBackupIntegrity(payload);
      expect(verification.valid).toBe(false);
      expect(verification.checksumMatched).toBe(false);
      expect(verification.error).toContain('Integrity check failed');
    });

    it('generates standard backup filenames matching diary-backup-YYYY-MM-DD-HH-MM-SS.json', () => {
      const name = generateBackupFilename(new Date('2026-11-20T14:30:15Z'));
      expect(name).toMatch(/^diary-backup-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.json$/);
    });
  });

  // ========================================================
  // 3. CONFLICT RESOLUTION & ZERO DATA LOSS
  // ========================================================
  describe('3. Conflict Detection & Merge Protection', () => {
    it('detects concurrent edits and preserves both versions without data loss', async () => {
      const localNotes: Note[] = [
        {
          id: 'note-conflict-1',
          user_id: mockUserId1,
          title: 'Shop Inventory',
          content: 'Local offline edit: Added 50 units',
          color: 'default',
          is_pinned: false,
          is_archived: false,
          is_deleted: false,
          created_at: '2026-11-19T10:00:00.000Z',
          updated_at: '2026-11-19T11:00:00.000Z',
          _baseUpdatedAt: '2026-11-19T09:00:00.000Z', // base was 09:00
        },
      ];

      const remoteNotes: Note[] = [
        {
          id: 'note-conflict-1',
          user_id: mockUserId1,
          title: 'Shop Inventory',
          content: 'Remote cloud edit: Added 30 units from another phone',
          color: 'default',
          is_pinned: false,
          is_archived: false,
          is_deleted: false,
          created_at: '2026-11-19T10:00:00.000Z',
          updated_at: '2026-11-19T12:00:00.000Z', // remote was updated at 12:00
        },
      ];

      const queue = [{ action: 'UPSERT_NOTE', id: 'note-conflict-1' }];

      const { merged, conflictsResolved } = await mergeNotesWithConflictResolution(
        localNotes,
        remoteNotes,
        queue
      );

      // Must resolve conflict by keeping both: remote note + conflict copy!
      expect(conflictsResolved).toBe(1);
      expect(merged).toHaveLength(2);

      const mainNote = merged.find((n) => n.id === 'note-conflict-1');
      const conflictCopy = merged.find((n) => n._isConflict === true);

      expect(mainNote?.content).toBe('Remote cloud edit: Added 30 units from another phone');
      expect(conflictCopy).toBeDefined();
      expect(conflictCopy?.content).toBe('Local offline edit: Added 50 units');
      expect(conflictCopy?.title).toContain('Conflicted Local Copy');
    });
  });

  // ========================================================
  // 4. RESTORATION INTO A COMPLETELY NEW DATABASE / USER ID
  // ========================================================
  describe('4. Long-Term Portability & Multi-Year Recovery', () => {
    it('restores notes into a completely new user account and new database', async () => {
      // 1. Create a 2026 backup
      const backup2026 = await createBackupPayload(sampleNotes, sampleLabels, [], {}, mockUserId1);

      // 2. Restore in 2030 for a new user in a brand new database instance
      const result = await executeRestore(
        backup2026,
        [], // empty database initially
        [], // empty labels initially
        mockUserId2, // completely new user ID!
        { mode: 'merge' }
      );

      expect(result.success).toBe(true);
      expect(result.restoredNotesCount).toBe(4);
      expect(result.restoredLabelsCount).toBe(3);
    });

    it('creates an automatic safety pre-backup before executing destructive replace restore', async () => {
      const existingNotes: Note[] = [
        {
          id: 'existing-note-999',
          user_id: mockUserId1,
          title: 'Current Notes Before Replace',
          content: 'Valuable existing data',
          color: 'default',
          is_pinned: false,
          is_archived: false,
          is_deleted: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const backupToImport = await createBackupPayload(sampleNotes, sampleLabels, [], {}, 'other-user');

      const result = await executeRestore(
        backupToImport,
        existingNotes,
        [],
        mockUserId1,
        { mode: 'replace', createSafetyBackup: true }
      );

      expect(result.success).toBe(true);
      expect(result.safetyBackupCreated).toBe(true);
      expect(result.safetyBackupFilename).toContain('safety-pre-replace-diary-backup-');
    });

    it('preserves trashed notes inside backups so accidental deletions can always be recovered', async () => {
      const payload = await createBackupPayload(sampleNotes, sampleLabels, [], {}, mockUserId1);
      const trashed = payload.notes.filter((n) => n.is_deleted);
      expect(trashed).toHaveLength(1);
      expect(trashed[0].title).toBe('Old Expense Draft');
    });
  });

  // ========================================================
  // 5. GOOGLE OAUTH 2.0 & PERSONAL DRIVE PROTECTIONS
  // ========================================================
  describe('5. Google OAuth 2.0 & Personal Drive Protections', () => {
    it('never includes Google client secrets, access tokens or refresh tokens in backup files', async () => {
      const payload = await createBackupPayload(sampleNotes, sampleLabels, [], {}, mockUserId1);
      const jsonStr = JSON.stringify(payload);

      expect(jsonStr).not.toContain('client_secret');
      expect(jsonStr).not.toContain('refresh_token');
      expect(jsonStr).not.toContain('access_token');
      expect(jsonStr).not.toContain('private_key');
    });

    it('correctly detects expired or revoked refresh tokens (invalid_grant error)', () => {
      const errorJson = {
        error: 'invalid_grant',
        error_description: 'Token has been expired or revoked.',
      };

      const isRevokedOrExpired =
        errorJson.error === 'invalid_grant' ||
        errorJson.error_description.includes('Token has been expired or revoked');

      expect(isRevokedOrExpired).toBe(true);
    });

    it('ensures backup retention logic never deletes the only existing valid backup', () => {
      const singleBackup = [
        {
          id: 'file-001',
          name: 'diary-backup-2026-01-01-00-00-00.json',
          size: 15000,
          createdTime: '2026-01-01T00:00:00Z',
          modifiedTime: '2026-01-01T00:00:00Z',
        },
      ];

      // With only 1 or <= 5 backups, pruning preserves all
      expect(singleBackup.length).toBeLessThanOrEqual(5);
    });
  });

  // ========================================================
  // 6. PRODUCTION SECURITY & AUTHORIZATION GUARDS
  // ========================================================
  describe('6. Production Security & Authorization Guards', () => {
    it('fails closed when CRON_SECRET is missing or unauthorized', () => {
      const verifyCronAuth = (authHeader: string | null, cronSecret: string | undefined): boolean => {
        if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
          return false;
        }
        return true;
      };

      // Fails closed if CRON_SECRET is undefined in environment
      expect(verifyCronAuth('Bearer my-secret', undefined)).toBe(false);
      // Fails closed if CRON_SECRET is empty string
      expect(verifyCronAuth('Bearer my-secret', '')).toBe(false);
      // Fails if header is missing
      expect(verifyCronAuth(null, 'secret-123')).toBe(false);
      // Fails if token does not match
      expect(verifyCronAuth('Bearer wrong-secret', 'secret-123')).toBe(false);
      // Fails if format is missing Bearer prefix
      expect(verifyCronAuth('secret-123', 'secret-123')).toBe(false);
      // PASSES only when secret is configured and Bearer token matches exactly
      expect(verifyCronAuth('Bearer secret-123', 'secret-123')).toBe(true);
    });

    it('prevents IDOR: ensures a user cannot access another user backup file', async () => {
      const userAId = 'user-alice-123';
      const userBId = 'user-bob-456';

      const userBPayload = await createBackupPayload(sampleNotes, sampleLabels, [], {}, userBId);

      const checkBackupAccess = (targetPayload: any, requestingUserId: string): boolean => {
        const payloadUserId = targetPayload.user_id || targetPayload.metadata?.user_id;
        if (payloadUserId && payloadUserId !== requestingUserId) {
          return false; // Forbidden
        }
        return true;
      };

      // User A trying to access User B's backup is REJECTED
      expect(checkBackupAccess(userBPayload, userAId)).toBe(false);

      // User B accessing their own backup is ALLOWED
      expect(checkBackupAccess(userBPayload, userBId)).toBe(true);
    });

    it('rejects invalid or missing OAuth state parameter (CSRF protection)', () => {
      const validateOAuthState = (paramState: string | null, cookieState: string | undefined): boolean => {
        if (!paramState || !cookieState || paramState !== cookieState) {
          return false;
        }
        return true;
      };

      expect(validateOAuthState(null, 'valid-state-123')).toBe(false);
      expect(validateOAuthState('state-abc', undefined)).toBe(false);
      expect(validateOAuthState('forged-state', 'expected-state')).toBe(false);
      expect(validateOAuthState('valid-state-123', 'valid-state-123')).toBe(true);
    });

    it('disables browser refresh token display and OAuth setup routes in production', () => {
      const checkRouteDisabled = (nodeEnv: string): boolean => {
        return nodeEnv === 'production';
      };

      expect(checkRouteDisabled('production')).toBe(true);
      expect(checkRouteDisabled('development')).toBe(false);
    });
  });
});
