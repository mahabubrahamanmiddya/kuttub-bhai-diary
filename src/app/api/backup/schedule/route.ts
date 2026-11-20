import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createBackupPayload, generateBackupFilename, verifyBackupIntegrity } from '@/lib/backup/crypto';
import {
  uploadBackupToDrive,
  listDriveBackups,
  pruneOldBackups,
  isGoogleDriveConfigured,
} from '@/lib/backup/google-drive';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    // 1. Authorization check
    const authHeader = req.headers.get('Authorization') || '';
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized schedule trigger' }, { status: 401 });
    }

    if (!isGoogleDriveConfigured()) {
      return NextResponse.json(
        { error: 'Google Drive is not configured on server' },
        { status: 503 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Supabase configuration missing' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // 2. Fetch all notes from database
    const { data: notesData, error: notesErr } = await supabase
      .from('notes')
      .select(`
        *,
        note_labels (
          labels (
            id,
            name,
            color
          )
        )
      `)
      .order('updated_at', { ascending: false });

    if (notesErr) {
      console.error('Scheduled backup failed: Supabase error:', notesErr);
      return NextResponse.json({ error: `Supabase query failed: ${notesErr.message}` }, { status: 502 });
    }

    const { data: labelsData, error: labelsErr } = await supabase.from('labels').select('*');
    if (labelsErr) {
      console.error('Scheduled backup failed: Labels query error:', labelsErr);
      return NextResponse.json({ error: `Labels query failed: ${labelsErr.message}` }, { status: 502 });
    }

    const { data: versionsData } = await supabase
      .from('note_versions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    const notes = (notesData || []).map((n: any) => ({
      ...n,
      labels: (n.note_labels || []).map((nl: any) => nl.labels).filter(Boolean),
    }));
    const labels = labelsData || [];
    const versions = versionsData || [];

    // CRITICAL PROTECTION: Never upload an unexpectedly empty backup caused by failed database!
    // Check if previous valid backups exist on Google Drive:
    const driveBackups = await listDriveBackups();
    if (notes.length === 0 && driveBackups.length > 0) {
      console.warn('ABORTED BACKUP: Database returned 0 notes while existing backups exist in Google Drive.');
      return NextResponse.json(
        {
          error: 'Safety abort: Database returned 0 notes while existing historical backups exist. Refusing to overwrite with empty backup.',
        },
        { status: 409 }
      );
    }

    // 3. Generate verified payload
    const filename = generateBackupFilename();
    const payload = await createBackupPayload(notes, labels, versions, { automated: true }, 'system_automated');

    // 4. Verify integrity
    const verification = await verifyBackupIntegrity(payload);
    if (!verification.valid) {
      throw new Error(`Integrity verification failed: ${verification.error}`);
    }

    // 5. Upload to Google Drive
    const jsonString = JSON.stringify(payload, null, 2);
    const driveResult = await uploadBackupToDrive(filename, jsonString);

    // 6. Record metadata in Supabase
    try {
      await supabase.from('backups_metadata').insert({
        user_id: notes[0]?.user_id || '00000000-0000-0000-0000-000000000000',
        filename,
        storage_location: 'github_actions',
        file_size_bytes: driveResult.size,
        notes_count: notes.length,
        labels_count: labels.length,
        checksum_sha256: payload.metadata.checksum_sha256,
        status: 'verified',
        drive_file_id: driveResult.fileId,
        details: { automated: true, checksum: driveResult.checksum },
      });
    } catch {}

    // 7. Prune older backups according to retention policy (preserving recovery points)
    let pruneResult = { deletedCount: 0, preservedCount: 0 };
    try {
      const allFiles = await listDriveBackups();
      pruneResult = await pruneOldBackups(allFiles);
    } catch (pruneErr) {
      console.warn('Pruning old backups warning:', pruneErr);
    }

    return NextResponse.json({
      success: true,
      filename,
      notesCount: notes.length,
      checksum: payload.metadata.checksum_sha256,
      driveResult,
      pruned: pruneResult,
      timestamp: new Date().toISOString(),
    });
  } catch (e: any) {
    console.error('Scheduled backup error:', e);
    return NextResponse.json({ error: e?.message || 'Scheduled backup failed' }, { status: 500 });
  }
}
