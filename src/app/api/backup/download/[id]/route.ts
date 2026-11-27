import { NextRequest, NextResponse } from 'next/server';
import { downloadDriveBackup, isGoogleDriveConfigured } from '@/lib/backup/google-drive';
import { getAuthenticatedUser } from '@/lib/auth/server';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const fileId = params.id;
    if (!fileId) {
      return NextResponse.json({ error: 'Missing file id' }, { status: 400 });
    }

    if (!isGoogleDriveConfigured()) {
      return NextResponse.json({ error: 'Google Drive is not configured' }, { status: 503 });
    }

    const user = await getAuthenticatedUser(req);
    if (isSupabaseConfigured() && !user) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required to download backup files' },
        { status: 401 }
      );
    }

    // 1. Database-level authorization check: Verify ownership if record exists
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && serviceKey && user) {
      try {
        const supabase = createClient(supabaseUrl, serviceKey);
        const { data: record } = await supabase
          .from('backups_metadata')
          .select('id, user_id, drive_file_id')
          .or(`drive_file_id.eq.${fileId},id.eq.${fileId}`)
          .maybeSingle();

        // If the record exists in the database and belongs to someone else, reject immediately
        if (record && record.user_id !== user.id) {
          return NextResponse.json(
            { error: "Forbidden: You do not have permission to access another user's backup file" },
            { status: 403 }
          );
        }
      } catch (dbErr) {
        console.warn('Authorization lookup warning:', dbErr);
      }
    }

    const content = await downloadDriveBackup(fileId);

    // 2. Payload-level authorization check: Inspect backup metadata for user ownership
    if (user) {
      try {
        const parsed = JSON.parse(content);
        const payloadUserId = parsed.user_id || parsed.metadata?.user_id;
        if (payloadUserId && payloadUserId !== user.id && payloadUserId !== 'system_automated') {
          return NextResponse.json(
            { error: "Forbidden: You do not have permission to access this backup payload" },
            { status: 403 }
          );
        }
      } catch (parseErr) {
        // If content is not valid JSON, reject
        return NextResponse.json({ error: 'Invalid backup file content' }, { status: 422 });
      }
    }

    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="drive-backup-${fileId}.json"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Download failed' }, { status: 500 });
  }
}
