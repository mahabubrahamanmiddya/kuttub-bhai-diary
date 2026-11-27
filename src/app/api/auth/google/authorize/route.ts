import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getAuthenticatedUser } from '@/lib/auth/server';
import { isSupabaseConfigured } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  // Task 5: Disable local OAuth setup routes in production
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      {
        error:
          'Local OAuth setup routes are disabled in production. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN via production environment variables.',
      },
      { status: 403 }
    );
  }

  // Task 4: Require authentication if Supabase is configured
  const user = await getAuthenticatedUser(req);
  if (isSupabaseConfigured() && !user) {
    return NextResponse.json(
      { error: 'Unauthorized: Authentication required to initiate Google OAuth' },
      { status: 401 }
    );
  }

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

  // Generate cryptographically secure random state parameter for CSRF mitigation
  const oauthState = crypto.randomBytes(32).toString('hex');

  // Construct OAuth 2.0 URL with offline access, consent prompt, and state parameter
  const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  googleAuthUrl.searchParams.set('client_id', clientId.trim());
  googleAuthUrl.searchParams.set('redirect_uri', redirectUri);
  googleAuthUrl.searchParams.set('response_type', 'code');
  googleAuthUrl.searchParams.set('state', oauthState);
  googleAuthUrl.searchParams.set(
    'scope',
    'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email'
  );
  googleAuthUrl.searchParams.set('access_type', 'offline');
  googleAuthUrl.searchParams.set('prompt', 'consent');

  const response = NextResponse.redirect(googleAuthUrl.toString());

  // Store state in a secure, httpOnly cookie for validation in the callback
  response.cookies.set('google_oauth_state', oauthState, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 10, // 10 minutes expiration
  });

  return response;
}
