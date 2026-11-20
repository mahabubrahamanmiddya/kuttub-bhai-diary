import crypto from 'crypto';

const FOLDER_NAME = 'Digital Diary Backups';
const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API_BASE = 'https://www.googleapis.com/upload/drive/v3';

export interface GoogleDriveFile {
  id: string;
  name: string;
  size: number;
  createdTime: string;
  modifiedTime: string;
  md5Checksum?: string;
}

export interface GoogleDriveConfig {
  serviceAccountEmail?: string;
  privateKey?: string;
  refreshToken?: string;
  clientId?: string;
  clientSecret?: string;
}

/**
 * Reads Google Drive credentials from environment variables.
 */
export function getGoogleDriveConfig(): GoogleDriveConfig | null {
  // 1. Service Account JSON key (entire JSON string)
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (serviceAccountJson) {
    try {
      const parsed = JSON.parse(serviceAccountJson);
      return {
        serviceAccountEmail: parsed.client_email,
        privateKey: parsed.private_key,
      };
    } catch (e) {
      console.error('Invalid GOOGLE_SERVICE_ACCOUNT_KEY JSON format:', e);
    }
  }

  // 2. Individual Service Account variables
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let key = process.env.GOOGLE_PRIVATE_KEY;
  if (email && key) {
    // Handle escaped newlines
    key = key.replace(/\\n/g, '\n');
    return {
      serviceAccountEmail: email,
      privateKey: key,
    };
  }

  // 3. User OAuth2 Refresh Token
  const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (refreshToken && clientId && clientSecret) {
    return {
      refreshToken,
      clientId,
      clientSecret,
    };
  }

  return null;
}

/**
 * Determines whether Google Drive integration is configured.
 */
export function isGoogleDriveConfigured(): boolean {
  return getGoogleDriveConfig() !== null;
}

/**
 * Obtains an OAuth2 access token for Google Drive API.
 */
async function getAccessToken(config: GoogleDriveConfig): Promise<string> {
  // Option A: Service Account (RS256 JWT Bearer Grant)
  if (config.serviceAccountEmail && config.privateKey) {
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT' };
    const claimSet = {
      iss: config.serviceAccountEmail,
      scope: 'https://www.googleapis.com/auth/drive.file',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    };

    const base64UrlEncode = (str: string) =>
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
    const signature = signer.sign(config.privateKey, 'base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    const signedJwt = `${unsignedJwt}.${signature}`;

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: signedJwt,
      }),
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      throw new Error(`Failed to authenticate with Google: ${errText}`);
    }

    const data = await tokenResponse.json();
    return data.access_token;
  }

  // Option B: Refresh Token
  if (config.refreshToken && config.clientId && config.clientSecret) {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: config.refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      throw new Error(`Failed to refresh Google token: ${errText}`);
    }

    const data = await tokenResponse.json();
    return data.access_token;
  }

  throw new Error('Google Drive authentication credentials are not provided.');
}

/**
 * Finds or creates the private "Digital Diary Backups" folder.
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

  // Create folder
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
  const config = getGoogleDriveConfig();
  if (!config) {
    throw new Error('Google Drive is not configured. Add credentials in environment variables.');
  }

  const accessToken = await getAccessToken(config);
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

  // Verification: Verify the file exists and has content
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
 * Lists backups from the "Digital Diary Backups" folder.
 */
export async function listDriveBackups(): Promise<GoogleDriveFile[]> {
  const config = getGoogleDriveConfig();
  if (!config) return [];

  const accessToken = await getAccessToken(config);
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
  const config = getGoogleDriveConfig();
  if (!config) {
    throw new Error('Google Drive is not configured.');
  }

  const accessToken = await getAccessToken(config);
  const downloadRes = await fetch(`${DRIVE_API_BASE}/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!downloadRes.ok) {
    throw new Error(`Failed to download backup file from Google Drive: ${await downloadRes.text()}`);
  }

  return await downloadRes.text();
}

/**
 * Prunes older backups to respect Google Drive storage limits
 * while maintaining daily, monthly, and yearly recovery points.
 * CRITICAL RULE: NEVER deletes the last valid backup!
 */
export async function pruneOldBackups(files: GoogleDriveFile[]): Promise<{ deletedCount: number; preservedCount: number }> {
  if (files.length <= 5) {
    // Always preserve at least 5 backups
    return { deletedCount: 0, preservedCount: files.length };
  }

  const config = getGoogleDriveConfig();
  if (!config) return { deletedCount: 0, preservedCount: files.length };

  const accessToken = await getAccessToken(config);
  const now = Date.now();
  const ONE_DAY = 24 * 60 * 60 * 1000;
  const SEVEN_DAYS = 7 * ONE_DAY;
  const THIRTY_DAYS = 30 * ONE_DAY;

  // Keep:
  // - All backups from last 7 days
  // - 1 backup per week for 7-30 days
  // - 1 backup per month for >30 days
  // - Most recent backup ALWAYS
  const keepIds = new Set<string>();
  keepIds.add(files[0].id); // Always keep newest backup

  const weeklyBuckets = new Set<string>();
  const monthlyBuckets = new Set<string>();

  const toDelete: GoogleDriveFile[] = [];

  for (const file of files) {
    const age = now - new Date(file.createdTime).getTime();

    if (age <= SEVEN_DAYS) {
      // Keep all in last 7 days
      keepIds.add(file.id);
    } else if (age <= THIRTY_DAYS) {
      // Weekly bucket
      const weekKey = `${new Date(file.createdTime).getFullYear()}-W${Math.floor(new Date(file.createdTime).getDate() / 7)}`;
      if (!weeklyBuckets.has(weekKey)) {
        weeklyBuckets.add(weekKey);
        keepIds.add(file.id);
      } else {
        toDelete.push(file);
      }
    } else {
      // Monthly bucket
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
