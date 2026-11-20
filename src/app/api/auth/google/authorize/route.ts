import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;

  if (!clientId) {
    return NextResponse.json(
      {
        error:
          'GOOGLE_CLIENT_ID is not configured in .env.local. Please create an OAuth Client ID in Google Cloud Console first.',
      },
      { status: 500 }
    );
  }

  // Determine redirect URI dynamically based on current origin
  const origin = req.nextUrl.origin;
  const redirectUri = `${origin}/api/auth/google/callback`;

  // Construct OAuth 2.0 URL with offline access and consent prompt
  const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  googleAuthUrl.searchParams.set('client_id', clientId.trim());
  googleAuthUrl.searchParams.set('redirect_uri', redirectUri);
  googleAuthUrl.searchParams.set('response_type', 'code');
  // drive.file scope grants full access to files created by this app without unrestricted access to other personal files
  googleAuthUrl.searchParams.set(
    'scope',
    'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email'
  );
  // CRITICAL FOR REFRESH TOKEN:
  googleAuthUrl.searchParams.set('access_type', 'offline');
  googleAuthUrl.searchParams.set('prompt', 'consent');

  return NextResponse.redirect(googleAuthUrl.toString());
}
