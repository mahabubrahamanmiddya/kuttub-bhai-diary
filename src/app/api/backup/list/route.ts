import { NextRequest, NextResponse } from 'next/server';
import { listDriveBackups, checkGoogleDriveStatus, isGoogleDriveConfigured } from '@/lib/backup/google-drive';
import { createClient } from '@supabase/supabase-js';
import { getAuthenticatedUser } from '@/lib/auth/server';
import { isSupabaseConfigured } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (isSupabaseConfigured() && !user) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required to list backups' },
        { status: 401 }
      );
    }

    const driveStatus = await checkGoogleDriveStatus();
    let driveBackups: any[] = [];
    let dbBackups: any[] = [];

    // Fetch records from Supabase backups_metadata scoped strictly to authenticated user
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (supabaseUrl && serviceKey) {
      try {
        const supabase = createClient(supabaseUrl, serviceKey);
        let query = supabase
          .from('backups_metadata')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);

        if (user) {
          query = query.eq('user_id', user.id);
        }

        const { data } = await query;
        if (data) dbBackups = data;
      } catch {}
    }

    if (driveStatus.authorized) {
      try {
        const allDriveBackups = await listDriveBackups();
        if (user && dbBackups.length > 0) {
          const allowedFileIds = new Set(dbBackups.map((b) => b.drive_file_id).filter(Boolean));
          driveBackups = allDriveBackups.filter((f) => allowedFileIds.has(f.id));
        } else if (!isSupabaseConfigured()) {
          driveBackups = allDriveBackups;
        }
      } catch (err: any) {
        console.warn('Could not list Google Drive backups:', err);
      }
    }

    return NextResponse.json({
      googleDriveConfigured: driveStatus.configured,
      googleDriveAuthorized: driveStatus.authorized,
      googleDriveStatus: driveStatus,
      driveBackups,
      dbBackups,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to list backups' }, { status: 500 });
  }
}
