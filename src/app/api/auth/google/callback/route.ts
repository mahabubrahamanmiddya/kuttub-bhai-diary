import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    return new NextResponse(
      renderHtmlResponse({
        success: false,
        title: 'Google Authorization Cancelled',
        message: `Google returned an error: ${error}. Please try again from Settings.`,
      }),
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }

  if (!code) {
    return new NextResponse(
      renderHtmlResponse({
        success: false,
        title: 'Missing Authorization Code',
        message: 'No authorization code was provided by Google.',
      }),
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return new NextResponse(
      renderHtmlResponse({
        success: false,
        title: 'Server Configuration Missing',
        message: 'GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing from .env.local.',
      }),
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }

  const redirectUri = `${req.nextUrl.origin}/api/auth/google/callback`;

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId.trim(),
        client_secret: clientSecret.trim(),
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.refresh_token) {
      const errMsg = tokenData.error_description || tokenData.error || 'Failed to exchange authorization code';
      return new NextResponse(
        renderHtmlResponse({
          success: false,
          title: 'Authorization Exchange Failed',
          message: `${errMsg}. (Note: If you previously authorized this app, go to Google Account Security > Third-party apps > remove access and re-authorize to receive a fresh refresh token).`,
        }),
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }

    const refreshToken = tokenData.refresh_token;

    return new NextResponse(
      renderHtmlResponse({
        success: true,
        title: 'Google Drive Successfully Authorized! 🎉',
        message: 'Your Google Drive is now ready for automatic and manual daily backups.',
        refreshToken,
      }),
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  } catch (err: any) {
    return new NextResponse(
      renderHtmlResponse({
        success: false,
        title: 'Connection Error',
        message: err?.message || 'Unexpected connection error while exchanging token',
      }),
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}

function renderHtmlResponse({
  success,
  title,
  message,
  refreshToken,
}: {
  success: boolean;
  title: string;
  message: string;
  refreshToken?: string;
}) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — Digital Diary</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #faf9f6;
      color: #1c1917;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 1rem;
    }
    .card {
      background: #ffffff;
      border: 1px solid #e7e5e4;
      border-radius: 1.5rem;
      padding: 2rem;
      max-width: 540px;
      width: 100%;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);
      text-align: center;
    }
    .badge {
      display: inline-block;
      width: 48px;
      height: 48px;
      border-radius: 1rem;
      background: ${success ? '#ecfdf5' : '#fff1f2'};
      color: ${success ? '#059669' : '#e11d48'};
      line-height: 48px;
      font-size: 24px;
      margin-bottom: 1rem;
    }
    h1 { font-size: 1.25rem; font-weight: 700; margin: 0 0 0.5rem 0; }
    p { font-size: 0.875rem; color: #78716c; line-height: 1.5; margin: 0 0 1.25rem 0; }
    .token-box {
      background: #f5f5f4;
      border: 1px solid #d6d3d1;
      border-radius: 0.75rem;
      padding: 0.75rem;
      font-family: monospace;
      font-size: 0.8rem;
      word-break: break-all;
      text-align: left;
      margin-bottom: 1rem;
      user-select: all;
    }
    .btn {
      display: inline-block;
      background: #f59e0b;
      color: #ffffff;
      font-weight: 600;
      font-size: 0.875rem;
      padding: 0.65rem 1.25rem;
      border-radius: 0.75rem;
      text-decoration: none;
      border: none;
      cursor: pointer;
      margin: 0.25rem;
    }
    .btn-secondary {
      background: #e7e5e4;
      color: #292524;
    }
    .instructions {
      text-align: left;
      font-size: 0.775rem;
      color: #57534e;
      background: #fefce8;
      border: 1px solid #fef08a;
      border-radius: 0.75rem;
      padding: 0.75rem;
      margin-top: 1rem;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">${success ? '✓' : '⚠'}</div>
    <h1>${title}</h1>
    <p>${message}</p>

    ${
      refreshToken
        ? `
      <div style="text-align: left; margin-bottom: 0.5rem; font-weight: 600; font-size: 0.75rem; text-transform: uppercase; color: #a8a29e;">
        Your Google Refresh Token:
      </div>
      <div class="token-box" id="tokenBox">${refreshToken}</div>
      <button class="btn" onclick="copyToken()">Copy Refresh Token</button>
      <a href="/" class="btn btn-secondary">Return to Diary</a>

      <div class="instructions">
        <strong>Next Steps:</strong>
        <ol style="margin: 0.5rem 0 0 1rem; padding: 0;">
          <li>Add this token to your <code>.env.local</code>:<br><code>GOOGLE_REFRESH_TOKEN="${refreshToken}"</code></li>
          <li>For automated daily backups, add it to <strong>GitHub Repository Secrets</strong> as <code>GOOGLE_REFRESH_TOKEN</code>.</li>
        </ol>
      </div>

      <script>
        function copyToken() {
          navigator.clipboard.writeText(document.getElementById('tokenBox').innerText);
          alert('Copied refresh token to clipboard!');
        }
      </script>
      `
        : `
      <a href="/" class="btn btn-secondary">Return to Diary</a>
      `
    }
  </div>
</body>
</html>`;
}
