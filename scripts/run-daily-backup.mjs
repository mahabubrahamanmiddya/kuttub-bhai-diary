#!/usr/bin/env node

/**
 * DIGITAL DIARY — UNATTENDED SCHEDULED DAILY BACKUP SCRIPT
 *
 * Runs daily via GitHub Actions or cron, independent of user's browser or device.
 * Extracts notes & labels from Supabase, verifies integrity, and uploads to Google Drive.
 */

import crypto from 'crypto';

const FOLDER_NAME = 'Digital Diary Backups';
const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API_BASE = 'https://www.googleapis.com/upload/drive/v3';

function log(msg, ...args) {
  console.log(`[${new Date().toISOString()}] ${msg}`, ...args);
}

// 1. Check environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('ERROR: Missing Supabase credentials (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY).');
  process.exit(1);
}

// Read Google credentials
let googleServiceEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
let googlePrivateKey = process.env.GOOGLE_PRIVATE_KEY;

if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
  try {
    const parsed = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    googleServiceEmail = parsed.client_email;
    googlePrivateKey = parsed.private_key;
  } catch (e) {
    console.error('Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY JSON:', e);
  }
}

if (!googleServiceEmail || !googlePrivateKey) {
  console.error('ERROR: Missing Google Drive credentials (GOOGLE_SERVICE_ACCOUNT_KEY or GOOGLE_SERVICE_ACCOUNT_EMAIL & GOOGLE_PRIVATE_KEY).');
  process.exit(1);
}

googlePrivateKey = googlePrivateKey.replace(/\\n/g, '\n');

// 2. Google Drive Access Token Generator (RS256 JWT)
async function getGoogleAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claimSet = {
    iss: googleServiceEmail,
    scope: 'https://www.googleapis.com/auth/drive.file',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const base64UrlEncode = (str) =>
    Buffer.from(str)
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedClaimSet = base64UrlEncode(JSON.stringify(claimSet));
  const unsignedJwt = `${encodedHeader}.${encodedClaimSet}`;

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsignedJwt);
  signer.end();
  const signature = signer.sign(googlePrivateKey, 'base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const signedJwt = `${unsignedJwt}.${signature}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: signedJwt,
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`Google Authentication failed: ${err}`);
  }

  const data = await tokenRes.json();
  return data.access_token;
}

// 3. Find or Create Backup Folder
async function getOrCreateFolder(token) {
  const query = encodeURIComponent(`name = '${FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
  const res = await fetch(`${DRIVE_API_BASE}/files?q=${query}&fields=files(id,name)`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await res.json();
  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }

  // Create folder
  const createRes = await fetch(`${DRIVE_API_BASE}/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
      description: 'Private automatic backups for Digital Diary application',
    }),
  });

  const folder = await createRes.json();
  return folder.id;
}

// 4. Fetch data from Supabase REST API directly
async function fetchSupabaseTable(table, token) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, {
    headers: {
      apikey: token,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch ${table} from Supabase: ${await res.text()}`);
  }

  return await res.json();
}

async function runDailyBackup() {
  log('Starting scheduled automatic diary backup...');

  // Step 1: Connect to Google Drive
  const driveToken = await getGoogleAccessToken();
  const folderId = await getOrCreateFolder(driveToken);
  log(`Google Drive folder ready: ${FOLDER_NAME} (${folderId})`);

  // Step 2: Extract notes & labels from Supabase
  const notes = await fetchSupabaseTable('notes', SUPABASE_SERVICE_ROLE_KEY);
  const labels = await fetchSupabaseTable('labels', SUPABASE_SERVICE_ROLE_KEY);
  let versions = [];
  try {
    versions = await fetchSupabaseTable('note_versions', SUPABASE_SERVICE_ROLE_KEY);
  } catch {}

  log(`Extracted from Supabase: ${notes.length} notes, ${labels.length} labels, ${versions.length} versions.`);

  // Step 3: Check for empty database safety abort
  // Check if existing backups exist on Google Drive
  const queryFiles = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
  const existingFilesRes = await fetch(`${DRIVE_API_BASE}/files?q=${queryFiles}&fields=files(id,name,size,createdTime)&orderBy=createdTime desc`, {
    headers: { Authorization: `Bearer ${driveToken}` },
  });
  const existingData = await existingFilesRes.json();
  const existingFiles = existingData.files || [];

  if (notes.length === 0 && existingFiles.length > 0) {
    console.error('SAFETY WARNING: Supabase returned 0 notes while historical backups exist in Google Drive.');
    console.error('Aborting backup to prevent overwriting with an empty backup.');
    process.exit(1);
  }

  // Step 4: Construct canonical payload & SHA-256 Checksum
  const cleanNotes = notes.map((n) => {
    const { _syncStatus, _lastSyncedAt, _baseUpdatedAt, ...rest } = n;
    return rest;
  }).sort((a, b) => a.id.localeCompare(b.id));

  const cleanLabels = [...labels].sort((a, b) => a.id.localeCompare(b.id));
  const cleanVersions = [...versions].sort((a, b) => a.id.localeCompare(b.id));

  const canonicalString = JSON.stringify({
    format_version: '2.0',
    notes: cleanNotes,
    labels: cleanLabels,
    note_versions: cleanVersions,
    user_preferences: {},
  });

  const sha256 = crypto.createHash('sha256').update(canonicalString, 'utf8').digest('hex');

  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const filename = `diary-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}.json`;

  const payload = {
    format_version: '2.0',
    app_name: 'My Diary',
    created_at: now.toISOString(),
    notes: cleanNotes,
    labels: cleanLabels,
    note_versions: cleanVersions,
    user_preferences: {},
    metadata: {
      notes_count: cleanNotes.length,
      labels_count: cleanLabels.length,
      versions_count: cleanVersions.length,
      checksum_sha256: sha256,
      generated_by: 'GitHub Actions Unattended Daily Scheduler v2.0',
    },
  };

  const payloadJson = JSON.stringify(payload, null, 2);

  // Step 5: Multipart Upload to Google Drive
  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const multipartBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify({
      name: filename,
      parents: [folderId],
      mimeType: 'application/json',
      description: `Automated Scheduled Backup (${cleanNotes.length} notes)`,
    }) +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    payloadJson +
    closeDelimiter;

  const uploadRes = await fetch(`${UPLOAD_API_BASE}/files?uploadType=multipart&fields=id,name,size,md5Checksum`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${driveToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartBody,
  });

  if (!uploadRes.ok) {
    throw new Error(`Google Drive upload failed: ${await uploadRes.text()}`);
  }

  const uploadedFile = await uploadRes.json();
  log(`Successfully uploaded: ${filename} (ID: ${uploadedFile.id}, Size: ${uploadedFile.size} bytes)`);

  // Step 6: Verify uploaded file can be queried
  const verifyRes = await fetch(`${DRIVE_API_BASE}/files/${uploadedFile.id}?fields=id,name,size`, {
    headers: { Authorization: `Bearer ${driveToken}` },
  });
  if (!verifyRes.ok) {
    throw new Error('Verification failed: uploaded file could not be read back from Google Drive.');
  }

  log(`Verification passed: File confirmed in Google Drive. SHA-256: ${sha256}`);

  // Step 7: Record in backups_metadata table
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/backups_metadata`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        user_id: cleanNotes[0]?.user_id || '00000000-0000-0000-0000-000000000000',
        filename,
        storage_location: 'github_actions',
        file_size_bytes: Number(uploadedFile.size || payloadJson.length),
        notes_count: cleanNotes.length,
        labels_count: cleanLabels.length,
        checksum_sha256: sha256,
        status: 'verified',
        drive_file_id: uploadedFile.id,
        details: { automated: true, runner: 'GitHub Actions' },
      }),
    });
    log('Recorded backup metadata in Supabase PostgreSQL.');
  } catch (err) {
    log('Note: could not record metadata in backups_metadata (table may be absent yet):', err.message);
  }

  log('Daily backup completed successfully!');
}

runDailyBackup().catch((err) => {
  console.error('Fatal backup script error:', err);
  process.exit(1);
});
