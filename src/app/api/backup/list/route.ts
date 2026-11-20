import { NextRequest, NextResponse } from 'next/server';
import { listDriveBackups, checkGoogleDriveStatus, isGoogleDriveConfigured } from '@/lib/backup/google-drive';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const driveStatus = await checkGoogleDriveStatus();
    let driveBackups: any[] = [];

    if (driveStatus.authorized) {
      try {
        driveBackups = await listDriveBackups();
      } catch (err: any) {
        console.warn('Could not list Google Drive backups:', err);
      }
    }

    // Also fetch records from Supabase backups_metadata if available
    let dbBackups: any[] = [];
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (supabaseUrl && serviceKey) {
      try {
        const supabase = createClient(supabaseUrl, serviceKey);
        const { data } = await supabase
          .from('backups_metadata')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);
        if (data) dbBackups = data;
      } catch {}
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
