import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock dependencies before importing route handlers
vi.mock('@/lib/auth/server', () => ({
  getAuthenticatedUser: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  isSupabaseConfigured: vi.fn(),
  getSupabaseClient: vi.fn(),
}));

vi.mock('@/lib/backup/google-drive', () => ({
  isGoogleDriveConfigured: vi.fn(),
  uploadBackupToDrive: vi.fn(),
  listDriveBackups: vi.fn(),
  downloadDriveBackup: vi.fn(),
  checkGoogleDriveStatus: vi.fn(),
  pruneOldBackups: vi.fn(),
}));

const mockSupabaseSelect = vi.fn();
const mockSupabaseInsert = vi.fn();
const mockSupabaseOr = vi.fn();
const mockSupabaseEq = vi.fn();
const mockSupabaseOrder = vi.fn();
const mockSupabaseLimit = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: mockSupabaseSelect,
      insert: mockSupabaseInsert,
      order: mockSupabaseOrder,
      limit: mockSupabaseLimit,
    })),
  })),
}));

import { getAuthenticatedUser } from '@/lib/auth/server';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import {
  isGoogleDriveConfigured,
  downloadDriveBackup,
  listDriveBackups,
  checkGoogleDriveStatus,
} from '@/lib/backup/google-drive';

import { POST as createBackupRoute } from '../src/app/api/backup/create/route';
import { GET as listBackupsRoute } from '../src/app/api/backup/list/route';
import { GET as downloadBackupRoute } from '../src/app/api/backup/download/[id]/route';
import { POST as scheduleBackupRoute } from '../src/app/api/backup/schedule/route';

describe('Route Handler Security & Regression Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.CRON_SECRET;
  });

  // ========================================================
  // 1. UNAUTHORIZED REQUESTS
  // ========================================================
  describe('1. Unauthorized Request Handling', () => {
    it('POST /api/backup/create rejects unauthenticated requests with 401 when cloud is configured', async () => {
      vi.mocked(isSupabaseConfigured).mockReturnValue(true);
      vi.mocked(getAuthenticatedUser).mockResolvedValue(null);

      const req = new NextRequest('http://localhost:3000/api/backup/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: [] }),
      });

      const res = await createBackupRoute(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toContain('Unauthorized');
    });

    it('GET /api/backup/list rejects unauthenticated requests with 401 when cloud is configured', async () => {
      vi.mocked(isSupabaseConfigured).mockReturnValue(true);
      vi.mocked(getAuthenticatedUser).mockResolvedValue(null);

      const req = new NextRequest('http://localhost:3000/api/backup/list', {
        method: 'GET',
      });

      const res = await listBackupsRoute(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toContain('Unauthorized');
    });

    it('GET /api/backup/download/[id] rejects unauthenticated requests with 401 when cloud is configured', async () => {
      vi.mocked(isGoogleDriveConfigured).mockReturnValue(true);
      vi.mocked(isSupabaseConfigured).mockReturnValue(true);
      vi.mocked(getAuthenticatedUser).mockResolvedValue(null);

      const req = new NextRequest('http://localhost:3000/api/backup/download/drive-file-123', {
        method: 'GET',
      });

      const res = await downloadBackupRoute(req, {
        params: Promise.resolve({ id: 'drive-file-123' }),
      });
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toContain('Unauthorized');
    });

    it('POST /api/backup/schedule rejects requests with missing or invalid Bearer secret with 401', async () => {
      process.env.CRON_SECRET = 'super-secret-cron-token-999';

      // Missing Authorization header
      const reqNoAuth = new NextRequest('http://localhost:3000/api/backup/schedule', {
        method: 'POST',
      });
      const resNoAuth = await scheduleBackupRoute(reqNoAuth);
      expect(resNoAuth.status).toBe(401);

      // Wrong Bearer token
      const reqWrongAuth = new NextRequest('http://localhost:3000/api/backup/schedule', {
        method: 'POST',
        headers: { Authorization: 'Bearer wrong-secret' },
      });
      const resWrongAuth = await scheduleBackupRoute(reqWrongAuth);
      expect(resWrongAuth.status).toBe(401);
    });
  });

  // ========================================================
  // 2. OWNERSHIP METADATA & SPOOFING PREVENTION
  // ========================================================
  describe('2. Missing Ownership Metadata & Spoofing Prevention', () => {
    it('POST /api/backup/create forces authenticated user ID, ignoring client-submitted spoofed userId', async () => {
      vi.mocked(isSupabaseConfigured).mockReturnValue(true);
      vi.mocked(isGoogleDriveConfigured).mockReturnValue(false); // test payload creation only
      vi.mocked(getAuthenticatedUser).mockResolvedValue({
        id: 'authenticated-victim-id',
        email: 'alice@example.com',
      });

      const req = new NextRequest('http://localhost:3000/api/backup/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: [{ id: 'n1', title: 'Private Note', content: 'Secret', created_at: '2026-01-01', updated_at: '2026-01-01' }],
          userId: 'spoofed-attacker-id', // Client attempts to spoof another user ID
          uploadToDrive: false,
        }),
      });

      const res = await createBackupRoute(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      // Payload MUST be bound to authenticated-victim-id, NEVER spoofed-attacker-id
      expect(data.backup.user_id).toBe('authenticated-victim-id');
    });

    it('GET /api/backup/download/[id] rejects payload with missing or mismatched ownership metadata with 403', async () => {
      vi.mocked(isGoogleDriveConfigured).mockReturnValue(true);
      vi.mocked(isSupabaseConfigured).mockReturnValue(false);
      vi.mocked(getAuthenticatedUser).mockResolvedValue({
        id: 'user-alice-123',
      });

      // Drive returns a backup payload that belongs to bob
      const bobPayload = JSON.stringify({
        format_version: '2.0',
        user_id: 'user-bob-999',
        notes: [{ id: 'note-1', content: 'Bob confidential' }],
        metadata: { checksum_sha256: 'abc' },
      });
      vi.mocked(downloadDriveBackup).mockResolvedValue(bobPayload);

      const req = new NextRequest('http://localhost:3000/api/backup/download/file-bob', {
        method: 'GET',
      });

      const res = await downloadBackupRoute(req, {
        params: Promise.resolve({ id: 'file-bob' }),
      });
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toContain('Forbidden');
    });

    it('GET /api/backup/download/[id] returns 422 if downloaded backup file content is corrupted non-JSON', async () => {
      vi.mocked(isGoogleDriveConfigured).mockReturnValue(true);
      vi.mocked(isSupabaseConfigured).mockReturnValue(false);
      vi.mocked(getAuthenticatedUser).mockResolvedValue({
        id: 'user-alice-123',
      });

      vi.mocked(downloadDriveBackup).mockResolvedValue('<<not-valid-json-data>>');

      const req = new NextRequest('http://localhost:3000/api/backup/download/file-corrupted', {
        method: 'GET',
      });

      const res = await downloadBackupRoute(req, {
        params: Promise.resolve({ id: 'file-corrupted' }),
      });
      expect(res.status).toBe(422);
      const json = await res.json();
      expect(json.error).toContain('Invalid backup file content');
    });
  });

  // ========================================================
  // 3. CROSS-USER ACCESS (IDOR PREVENTION)
  // ========================================================
  describe('3. Cross-User Access (IDOR Prevention)', () => {
    it('GET /api/backup/download/[id] rejects access if database metadata record belongs to another user (403)', async () => {
      vi.mocked(isGoogleDriveConfigured).mockReturnValue(true);
      vi.mocked(isSupabaseConfigured).mockReturnValue(true);
      vi.mocked(getAuthenticatedUser).mockResolvedValue({
        id: 'user-alice',
      });

      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role-key';

      // Mock DB query returning a record owned by user-bob
      mockSupabaseSelect.mockReturnValue({
        or: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: 'meta-123', user_id: 'user-bob', drive_file_id: 'drive-bob-456' },
            error: null,
          }),
        }),
      });

      const req = new NextRequest('http://localhost:3000/api/backup/download/drive-bob-456', {
        method: 'GET',
      });

      const res = await downloadBackupRoute(req, {
        params: Promise.resolve({ id: 'drive-bob-456' }),
      });

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toContain("Forbidden: You do not have permission to access another user's backup file");
      // Must NOT attempt to download file from Google Drive when DB check fails
      expect(downloadDriveBackup).not.toHaveBeenCalled();
    });

    it('GET /api/backup/list scopes metadata query strictly to caller user_id', async () => {
      vi.mocked(isSupabaseConfigured).mockReturnValue(true);
      vi.mocked(getAuthenticatedUser).mockResolvedValue({
        id: 'user-charlie-789',
      });
      vi.mocked(checkGoogleDriveStatus).mockResolvedValue({
        configured: false,
        authorized: false,
        code: 'NOT_CONFIGURED',
        message: 'Google Drive is not configured',
      });

      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role-key';

      const mockEq = vi.fn().mockResolvedValue({
        data: [{ id: 'b1', user_id: 'user-charlie-789', filename: 'diary-backup-1.json' }],
      });
      const mockLimit = vi.fn().mockReturnValue({
        eq: mockEq,
      });
      const mockOrder = vi.fn().mockReturnValue({
        limit: mockLimit,
      });
      mockSupabaseSelect.mockReturnValue({
        order: mockOrder,
      });

      const req = new NextRequest('http://localhost:3000/api/backup/list', {
        method: 'GET',
      });

      const res = await listBackupsRoute(req);
      expect(res.status).toBe(200);
      // Verify query restricted to user-charlie-789
      expect(mockEq).toHaveBeenCalledWith('user_id', 'user-charlie-789');
    });
  });

  // ========================================================
  // 4. MISSING ENVIRONMENT VARIABLES
  // ========================================================
  describe('4. Missing Environment Variables Handling', () => {
    it('POST /api/backup/schedule fails closed (401) when CRON_SECRET is not configured', async () => {
      delete process.env.CRON_SECRET;

      const req = new NextRequest('http://localhost:3000/api/backup/schedule', {
        method: 'POST',
        headers: { Authorization: 'Bearer some-token' },
      });

      const res = await scheduleBackupRoute(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toContain('Unauthorized');
    });

    it('POST /api/backup/schedule returns 503 when Google Drive is not configured', async () => {
      process.env.CRON_SECRET = 'valid-cron-secret-123';
      vi.mocked(isGoogleDriveConfigured).mockReturnValue(false);

      const req = new NextRequest('http://localhost:3000/api/backup/schedule', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-cron-secret-123' },
      });

      const res = await scheduleBackupRoute(req);
      expect(res.status).toBe(503);
      const json = await res.json();
      expect(json.error).toContain('Google Drive is not configured');
    });

    it('GET /api/backup/download/[id] returns 503 when Google Drive is not configured', async () => {
      vi.mocked(isGoogleDriveConfigured).mockReturnValue(false);

      const req = new NextRequest('http://localhost:3000/api/backup/download/file-123', {
        method: 'GET',
      });

      const res = await downloadBackupRoute(req, {
        params: Promise.resolve({ id: 'file-123' }),
      });
      expect(res.status).toBe(503);
      const json = await res.json();
      expect(json.error).toContain('Google Drive is not configured');
    });

    it('POST /api/backup/create returns 400 when missing required notes array', async () => {
      vi.mocked(isSupabaseConfigured).mockReturnValue(false);

      const req = new NextRequest('http://localhost:3000/api/backup/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const res = await createBackupRoute(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('Missing notes array');
    });
  });
});
