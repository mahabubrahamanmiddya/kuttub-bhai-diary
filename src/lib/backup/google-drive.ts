const FOLDER_NAME = 'Digital Diary Backups';
const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API_BASE = 'https://www.googleapis.com/upload/drive/v3';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

export interface GoogleDriveFile {
  id: string;
  name: string;
  size: number;
  createdTime: string;
  modifiedTime: string;
  md5Checksum?: string;
}

export interface GoogleDriveOAuthCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

export interface GoogleDriveStatus {
  configured: boolean;
  authorized: boolean;
  code: 'AUTHENTICATED' | 'NOT_CONFIGURED' | 'EXPIRED_OR_REVOKED' | 'NETWORK_ERROR';
  message: string;
}

export class GoogleAuthError extends Error {
  isExpiredOrRevoked: boolean;
  statusCode?: number;

  constructor(message: string, isExpiredOrRevoked = false, statusCode?: number) {
    super(message);
    this.name = 'GoogleAuthError';
    this.isExpiredOrRevoked = isExpiredOrRevoked;
    this.statusCode = statusCode;
  }
}

// In-memory token cache to avoid refreshing access token on every single request
let cachedAccessToken: string | null = null;
let tokenExpiresAt = 0;

/**
 * Reads Google OAuth 2.0 credentials from environment variables.
 * Safe for server-side execution only.
 */
export function getGoogleOAuthCredentials(): GoogleDriveOAuthCredentials | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN || process.env.GOOGLE_DRIVE_REFRESH_TOKEN;

  if (clientId && clientSecret && refreshToken) {
    return {
      clientId: clientId.trim(),
      clientSecret: clientSecret.trim(),
      refreshToken: refreshToken.trim(),
    };
  }

  return null;
}

/**
 * Checks if Google Drive OAuth 2.0 credentials are configured.
 */
export function isGoogleDriveConfigured(): boolean {
  return getGoogleOAuthCredentials() !== null;
}

/**
 * Refreshes and returns a valid Google Drive API access token using the stored refresh token.
 * Detects expired or revoked authorization (invalid_grant) and caches valid tokens.
 */
export async function getFreshAccessToken(forceRefresh = false): Promise<string> {
  const creds = getGoogleOAuthCredentials();
  if (!creds) {
    throw new GoogleAuthError(
      'Google Drive OAuth 2.0 credentials not configured (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN missing).',
      false
    );
  }

  const now = Date.now();
  // Return cached token if valid for at least 3 more minutes
  if (!forceRefresh && cachedAccessToken && tokenExpiresAt > now + 3 * 60 * 1000) {
    return cachedAccessToken;
  }

  try {
    const response = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        refresh_token: creds.refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorJson: any = null;
      try {
        errorJson = JSON.parse(errorText);
      } catch {}

      const errorCode = errorJson?.error || '';
      const errorDesc = errorJson?.error_description || errorText;

      // Detect expired or revoked authorization specifically
      if (errorCode === 'invalid_grant' || errorDesc.includes('Token has been expired or revoked')) {
        cachedAccessToken = null;
        tokenExpiresAt = 0;
        throw new GoogleAuthError(
          'Google Drive authorization has expired or was revoked. Please generate a new refresh token or re-authorize.',
          true,
          response.status
        );
      }

      throw new GoogleAuthError(
        `Failed to refresh Google access token (${response.status}): ${errorDesc}`,
        false,
        response.status
      );
    }

    const data = await response.json();
    cachedAccessToken = data.access_token;
    // expires_in is in seconds (default 3600 = 1 hour)
    tokenExpiresAt = now + (data.expires_in || 3600) * 1000;

    return cachedAccessToken as string;
  } catch (err: any) {
    if (err instanceof GoogleAuthError) {
      throw err;
    }
    throw new GoogleAuthError(`Network error while refreshing Google access token: ${err?.message || err}`, false);
  }
}

/**
 * Diagnostics check: tests authorization and returns detailed status for the UI.
 */
export async function checkGoogleDriveStatus(): Promise<GoogleDriveStatus> {
  if (!isGoogleDriveConfigured()) {
    return {
      configured: false,
      authorized: false,
      code: 'NOT_CONFIGURED',
      message: 'Google Drive credentials are not yet configured in environment variables or GitHub Secrets.',
    };
  }

  try {
    const token = await getFreshAccessToken();
    // Test a lightweight API call to verify token works
    const res = await fetch(`${DRIVE_API_BASE}/about?fields=user`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const err = await res.text();
      return {
        configured: true,
        authorized: false,
        code: 'NETWORK_ERROR',
        message: `Google Drive API error: ${err}`,
      };
    }

    const aboutData = await res.json();
    const userEmail = aboutData?.user?.emailAddress || 'Personal Google Drive';

    return {
      configured: true,
      authorized: true,
      code: 'AUTHENTICATED',
      message: `Connected to personal Google Drive (${userEmail})`,
    };
  } catch (err: any) {
    if (err instanceof GoogleAuthError && err.isExpiredOrRevoked) {
      return {
        configured: true,
        authorized: false,
        code: 'EXPIRED_OR_REVOKED',
        message: 'Google authorization expired or was revoked. Re-authorization required.',
      };
    }
    return {
      configured: true,
      authorized: false,
      code: 'NETWORK_ERROR',
      message: err?.message || 'Error communicating with Google Drive',
    };
  }
}

/**
 * Finds or creates the private "Digital Diary Backups" folder in the user's personal Google Drive.
 */
export async function getOrCreateBackupFolder(accessToken: string): Promise<string> {
  const query = encodeURIComponent(
    `name = '${FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
  );

  const searchRes = await fetch(`${DRIVE_API_BASE}/files?q=${query}&fields=files(id,name)`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!searchRes.ok) {
    const err = await searchRes.text();
    throw new Error(`Failed to search Google Drive folders: ${err}`);
  }

  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // Create the folder in personal Google Drive
  const createRes = await fetch(`${DRIVE_API_BASE}/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
      description: 'Private automatic backups for Digital Diary application',
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Failed to create Google Drive backup folder: ${err}`);
  }

  const folderData = await createRes.json();
  return folderData.id;
}

/**
 * Uploads a verified backup payload directly to the "Digital Diary Backups" folder.
 */
export async function uploadBackupToDrive(
  filename: string,
  backupJsonContent: string
): Promise<{ success: boolean; fileId: string; filename: string; size: number; checksum: string }> {
  const accessToken = await getFreshAccessToken();
  const folderId = await getOrCreateBackupFolder(accessToken);

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const fileMetadata = {
    name: filename,
    parents: [folderId],
    mimeType: 'application/json',
    description: `Digital Diary Backup created ${new Date().toISOString()}`,
  };

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(fileMetadata) +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    backupJsonContent +
    closeDelimiter;

  const uploadRes = await fetch(
    `${UPLOAD_API_BASE}/files?uploadType=multipart&fields=id,name,size,md5Checksum`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    }
  );

  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    throw new Error(`Google Drive upload failed: ${err}`);
  }

  const uploadedFile = await uploadRes.json();

  // Verification: Verify the file exists in personal Google Drive and has non-zero size
  const verifyRes = await fetch(`${DRIVE_API_BASE}/files/${uploadedFile.id}?fields=id,name,size,md5Checksum`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!verifyRes.ok) {
    throw new Error('Backup verification failed: uploaded file could not be read back from Google Drive.');
  }

  const verifiedData = await verifyRes.json();
  const size = Number(verifiedData.size || 0);

  if (size === 0) {
    throw new Error('Backup verification failed: uploaded file is 0 bytes.');
  }

  return {
    success: true,
    fileId: verifiedData.id,
    filename: verifiedData.name,
    size,
    checksum: verifiedData.md5Checksum || '',
  };
}

/**
 * Lists backups from the "Digital Diary Backups" folder in personal Google Drive.
 */
export async function listDriveBackups(): Promise<GoogleDriveFile[]> {
  if (!isGoogleDriveConfigured()) return [];

  const accessToken = await getFreshAccessToken();
  const folderId = await getOrCreateBackupFolder(accessToken);

  const query = encodeURIComponent(`'${folderId}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'`);
  const listRes = await fetch(
    `${DRIVE_API_BASE}/files?q=${query}&fields=files(id,name,size,createdTime,modifiedTime,md5Checksum)&orderBy=createdTime desc&pageSize=100`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!listRes.ok) {
    console.error('Failed to list Google Drive backups:', await listRes.text());
    return [];
  }

  const data = await listRes.json();
  return (data.files || []).map((f: any) => ({
    id: f.id,
    name: f.name,
    size: Number(f.size || 0),
    createdTime: f.createdTime,
    modifiedTime: f.modifiedTime,
    md5Checksum: f.md5Checksum,
  }));
}

/**
 * Downloads a specific backup file content by its Google Drive File ID.
 */
export async function downloadDriveBackup(fileId: string): Promise<string> {
  const accessToken = await getFreshAccessToken();
  const downloadRes = await fetch(`${DRIVE_API_BASE}/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!downloadRes.ok) {
    throw new Error(`Failed to download backup file from Google Drive: ${await downloadRes.text()}`);
  }

  return await downloadRes.text();
}

/**
 * Prunes older backups to respect Google Drive free storage
 * while maintaining daily, weekly, monthly, and yearly recovery points.
 * CRITICAL RULE: NEVER deletes the last valid backup!
 */
export async function pruneOldBackups(files: GoogleDriveFile[]): Promise<{ deletedCount: number; preservedCount: number }> {
  if (files.length <= 5) {
    return { deletedCount: 0, preservedCount: files.length };
  }

  const accessToken = await getFreshAccessToken();
  const now = Date.now();
  const ONE_DAY = 24 * 60 * 60 * 1000;
  const SEVEN_DAYS = 7 * ONE_DAY;
  const THIRTY_DAYS = 30 * ONE_DAY;

  const keepIds = new Set<string>();
  keepIds.add(files[0].id); // Always keep the newest backup

  const weeklyBuckets = new Set<string>();
  const monthlyBuckets = new Set<string>();
  const toDelete: GoogleDriveFile[] = [];

  for (const file of files) {
    const age = now - new Date(file.createdTime).getTime();

    if (age <= SEVEN_DAYS) {
      keepIds.add(file.id);
    } else if (age <= THIRTY_DAYS) {
      const weekKey = `${new Date(file.createdTime).getFullYear()}-W${Math.floor(new Date(file.createdTime).getDate() / 7)}`;
      if (!weeklyBuckets.has(weekKey)) {
        weeklyBuckets.add(weekKey);
        keepIds.add(file.id);
      } else {
        toDelete.push(file);
      }
    } else {
      const monthKey = `${new Date(file.createdTime).getFullYear()}-${new Date(file.createdTime).getMonth()}`;
      if (!monthlyBuckets.has(monthKey)) {
        monthlyBuckets.add(monthKey);
        keepIds.add(file.id);
      } else {
        toDelete.push(file);
      }
    }
  }

  // Safety check: Never delete if only 1 remains
  if (keepIds.size < 1) {
    return { deletedCount: 0, preservedCount: files.length };
  }

  let deletedCount = 0;
  for (const file of toDelete) {
    try {
      await fetch(`${DRIVE_API_BASE}/files/${file.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      deletedCount++;
    } catch (e) {
      console.warn(`Failed to prune backup file ${file.id}:`, e);
    }
  }

  return { deletedCount, preservedCount: files.length - deletedCount };
}
