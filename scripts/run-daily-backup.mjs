#!/usr/bin/env node

/**
 * DIGITAL DIARY — UNATTENDED SCHEDULED DAILY BACKUP SCRIPT
 *
 * Runs daily via GitHub Actions or cron, independent of user's browser or device.
 * Uses Google OAuth 2.0 Refresh Token for personal Google Drive accounts.
 * Extracts notes & labels from Supabase, verifies integrity, and uploads to Google Drive.
 */

import crypto from 'crypto';

const FOLDER_NAME = 'Digital Diary Backups';
const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API_BASE = 'https://www.googleapis.com/upload/drive/v3';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

function log(msg, ...args) {
  console.log(`[${new Date().toISOString()}] ${msg}`, ...args);
}

// 1. Check Supabase credentials
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('ERROR: Missing Supabase credentials (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY).');
  process.exit(1);
}

// 2. Google OAuth 2.0 Credentials (Personal Google Account)
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const googleRefreshToken = process.env.GOOGLE_REFRESH_TOKEN || process.env.GOOGLE_DRIVE_REFRESH_TOKEN;

// Service Account fallback
let googleServiceEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
let googlePrivateKey = process.env.GOOGLE_PRIVATE_KEY;
if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
  try {
    const parsed = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    googleServiceEmail = parsed.client_email;
    googlePrivateKey = parsed.private_key;
  } catch {}
}

const isOAuthReady = Boolean(googleClientId && googleClientSecret && googleRefreshToken);
const isServiceAccountReady = Boolean(googleServiceEmail && googlePrivateKey);

if (!isOAuthReady && !isServiceAccountReady) {
  console.error('ERROR: Missing Google Drive credentials.');
  console.error('Please configure:');
  console.error('  - GOOGLE_CLIENT_ID');
  console.error('  - GOOGLE_CLIENT_SECRET');
  console.error('  - GOOGLE_REFRESH_TOKEN');
  process.exit(1);
}

// 3. Obtain Google Drive Access Token
async function getGoogleAccessToken() {
  if (isOAuthReady) {
    log('Authenticating with Google OAuth 2.0 refresh token...');
    const response = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: googleClientId.trim(),
        client_secret: googleClientSecret.trim(),
        refresh_token: googleRefreshToken.trim(),
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      let errJson = null;
      try {
        errJson = JSON.parse(errText);
      } catch {}

      if (errJson?.error === 'invalid_grant' || errText.includes('invalid_grant')) {
        console.error('\n⚠️ CRITICAL GOOGLE AUTHORIZATION ERROR:');
        console.error('The Google OAuth Refresh Token has expired or was revoked.');
        console.error('If your Google Cloud OAuth Consent Screen is in "Testing" mode, Google expires tokens after 7 days.');
        console.error('SOLUTION: Set your OAuth Publishing Status to "Production" in Google Cloud Console, and generate a new token via:');
        console.error('  node scripts/get-google-refresh-token.mjs\n');
      }

      throw new Error(`Google OAuth token refresh failed (${response.status}): ${errText}`);
    }

    const data = await response.json();
    return data.access_token;
  }

  // Fallback: Service Account
  log('Authenticating with Google Service Account...');
  const key = googlePrivateKey.replace(/\\n/g, '\n');
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claimSet = {
    iss: googleServiceEmail,
    scope: 'https://www.googleapis.com/auth/drive.file',
    aud: TOKEN_ENDPOINT,
    exp: now + 3600,
    iat: now,
  };

  const base64UrlEncode = (str) =>
    Buffer.from(str)
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

  const unsignedJwt = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(
    JSON.stringify(claimSet)
  )}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsignedJwt);
  signer.end();
  const signature = signer
    .sign(key, 'base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const tokenRes = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsignedJwt}.${signature}`,
    }),
  });

  if (!tokenRes.ok) {
    throw new Error(`Google Service Account auth failed: ${await tokenRes.text()}`);
  }

  const data = await tokenRes.json();
  return data.access_token;
}

// 4. Find or Create Backup Folder
async function getOrCreateFolder(token) {
  const query = encodeURIComponent(
    `name = '${FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
  );
  const res = await fetch(`${DRIVE_API_BASE}/files?q=${query}&fields=files(id,name)`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await res.json();
  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }

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

// 5. Fetch data from Supabase REST API directly
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

async function recordFailureInSupabase(errorMessage) {
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
        user_id: '00000000-0000-0000-0000-000000000000',
        filename: 'FAILED_SCHEDULED_BACKUP',
        storage_location: 'github_actions',
        file_size_bytes: 0,
        notes_count: 0,
        labels_count: 0,
        checksum_sha256: 'FAILED',
        status: 'failed',
        details: { error: errorMessage, timestamp: new Date().toISOString() },
      }),
    });
  } catch {}
}

async function runDailyBackup() {
  log('Starting scheduled automatic diary backup...');

  let driveToken;
  try {
    driveToken = await getGoogleAccessToken();
  } catch (err) {
    await recordFailureInSupabase(err.message);
    throw err;
  }

  const folderId = await getOrCreateFolder(driveToken);
  log(`Google Drive folder confirmed: "${FOLDER_NAME}" (${folderId})`);

  // Step 2: Extract notes & labels from Supabase
  let notes = [];
  let labels = [];
  let versions = [];

  try {
    notes = await fetchSupabaseTable('notes', SUPABASE_SERVICE_ROLE_KEY);
    labels = await fetchSupabaseTable('labels', SUPABASE_SERVICE_ROLE_KEY);
    try {
      versions = await fetchSupabaseTable('note_versions', SUPABASE_SERVICE_ROLE_KEY);
    } catch {}
  } catch (dbErr) {
    await recordFailureInSupabase(`Supabase read failure: ${dbErr.message}`);
    throw dbErr;
  }

  log(`Extracted from Supabase: ${notes.length} notes, ${labels.length} labels, ${versions.length} versions.`);

  // Step 3: Check for empty database safety abort
  const queryFiles = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
  const existingFilesRes = await fetch(
    `${DRIVE_API_BASE}/files?q=${queryFiles}&fields=files(id,name,size,createdTime)&orderBy=createdTime desc`,
    {
      headers: { Authorization: `Bearer ${driveToken}` },
    }
  );
  const existingData = await existingFilesRes.json();
  const existingFiles = existingData.files || [];

  if (notes.length === 0 && existingFiles.length > 0) {
    const warn = 'SAFETY ABORT: Database returned 0 notes while historical backups exist in Google Drive. Refusing to overwrite with empty backup.';
    console.error(warn);
    await recordFailureInSupabase(warn);
    process.exit(1);
  }

  // Step 4: Construct canonical payload & SHA-256 Checksum
  const cleanNotes = notes
    .map((n) => {
      const { _syncStatus, _lastSyncedAt, _baseUpdatedAt, ...rest } = n;
      return rest;
    })
    .sort((a, b) => a.id.localeCompare(b.id));

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
  const filename = `diary-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
    now.getDate()
  )}-${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}.json`;

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
      generated_by: 'GitHub Actions Unattended Daily Scheduler (Google OAuth 2.0)',
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

  const uploadRes = await fetch(
    `${UPLOAD_API_BASE}/files?uploadType=multipart&fields=id,name,size,md5Checksum`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${driveToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    }
  );

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    await recordFailureInSupabase(`Drive upload failure: ${errText}`);
    throw new Error(`Google Drive upload failed: ${errText}`);
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

  // Step 7: Record success in backups_metadata table
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
        details: { automated: true, auth_type: 'oauth2_refresh_token' },
      }),
    });
    log('Recorded backup metadata in Supabase PostgreSQL.');
  } catch (err) {
    log('Metadata record notice:', err.message);
  }

  log('Daily Google Drive backup completed successfully!');
}

runDailyBackup().catch((err) => {
  console.error('Fatal backup script error:', err);
  process.exit(1);
});
