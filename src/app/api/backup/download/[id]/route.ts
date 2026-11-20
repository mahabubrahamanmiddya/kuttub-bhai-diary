import { NextRequest, NextResponse } from 'next/server';
import { downloadDriveBackup, isGoogleDriveConfigured } from '@/lib/backup/google-drive';

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

    const content = await downloadDriveBackup(fileId);
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
