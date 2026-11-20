import { NextRequest, NextResponse } from 'next/server';
import { createBackupPayload, generateBackupFilename, verifyBackupIntegrity } from '@/lib/backup/crypto';
import { uploadBackupToDrive, isGoogleDriveConfigured } from '@/lib/backup/google-drive';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { notes, labels, versions, preferences, userId, uploadToDrive = true } = body;

    if (!Array.isArray(notes)) {
      return NextResponse.json({ error: 'Missing notes array' }, { status: 400 });
    }

    // Never upload an empty backup caused by failed DB read if notes existed!
    const filename = generateBackupFilename();
    const payload = await createBackupPayload(notes, labels || [], versions || [], preferences || {}, userId);

    // Verify integrity of our own generated backup before proceeding
    const verification = await verifyBackupIntegrity(payload);
    if (!verification.valid) {
      return NextResponse.json(
        { error: `Internal backup integrity check failed: ${verification.error}` },
        { status: 500 }
      );
    }

    const jsonString = JSON.stringify(payload, null, 2);
    let driveResult: any = null;

    if (uploadToDrive && isGoogleDriveConfigured()) {
      try {
        driveResult = await uploadBackupToDrive(filename, jsonString);

        // Record in Supabase backups_metadata if configured
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceKey =
          process.env.SUPABASE_SERVICE_ROLE_KEY ||
          process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (supabaseUrl && serviceKey && userId) {
          const supabase = createClient(supabaseUrl, serviceKey);
          await supabase.from('backups_metadata').insert({
            user_id: userId,
            filename,
            storage_location: 'google_drive',
            file_size_bytes: driveResult.size,
            notes_count: notes.length,
            labels_count: (labels || []).length,
            checksum_sha256: payload.metadata.checksum_sha256,
            status: 'verified',
            drive_file_id: driveResult.fileId,
            details: { driveResponse: driveResult },
          });
        }
      } catch (driveErr: any) {
        console.error('Failed to upload to Google Drive during backup create:', driveErr);
        // We still return the payload so user gets their local backup, but report warning
        return NextResponse.json({
          success: true,
          backup: payload,
          filename,
          driveWarning: driveErr?.message || 'Google Drive upload failed',
          checksum: payload.metadata.checksum_sha256,
        });
      }
    }

    return NextResponse.json({
      success: true,
      backup: payload,
      filename,
      driveResult,
      checksum: payload.metadata.checksum_sha256,
      sizeBytes: jsonString.length,
    });
  } catch (e: any) {
    console.error('Backup creation error:', e);
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}
