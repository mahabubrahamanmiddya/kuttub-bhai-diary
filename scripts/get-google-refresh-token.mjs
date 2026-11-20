#!/usr/bin/env node

/**
 * INTERACTIVE GOOGLE OAUTH 2.0 REFRESH TOKEN GENERATOR
 *
 * Use this script to authorize your personal Google Drive account and obtain
 * a permanent Refresh Token for unattended daily backups and manual backups.
 *
 * Usage:
 *   node scripts/get-google-refresh-token.mjs
 */

import http from 'http';
import readline from 'readline';
import fs from 'fs';
import path from 'path';

// Helper to load .env.local if present
function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const [key, ...vals] = trimmed.split('=');
      const val = vals.join('=').replace(/^["']|["']$/g, '');
      if (key && !process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

loadEnvLocal();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function main() {
  console.log('\n======================================================');
  console.log('  GOOGLE OAUTH 2.0 REFRESH TOKEN GENERATOR (PERSONAL GMAIL)');
  console.log('======================================================\n');

  let clientId = process.env.GOOGLE_CLIENT_ID;
  let clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId) {
    clientId = await question('Enter your Google Client ID: ');
  } else {
    console.log(`Using GOOGLE_CLIENT_ID from .env.local: ${clientId.slice(0, 15)}...`);
  }

  if (!clientSecret) {
    clientSecret = await question('Enter your Google Client Secret: ');
  } else {
    console.log(`Using GOOGLE_CLIENT_SECRET from .env.local: ${clientSecret.slice(0, 5)}...`);
  }

  clientId = clientId.trim();
  clientSecret = clientSecret.trim();

  const redirectUri = 'http://localhost:8085';

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set(
    'scope',
    'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email'
  );
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');

  console.log('\n------------------------------------------------------');
  console.log('1. Ensure that in Google Cloud Console > Credentials:');
  console.log(`   You added "${redirectUri}" to Authorized redirect URIs.`);
  console.log('\n2. Open this URL in your web browser:');
  console.log(`\n\x1b[36m${authUrl.toString()}\x1b[0m\n`);
  console.log('3. Log in with your personal Google account and click "Continue".');
  console.log('------------------------------------------------------\n');
  console.log('Waiting for authorization callback on http://localhost:8085 ...');

  // Start temporary local server to capture the authorization code
  const server = http.createServer(async (req, res) => {
    try {
      const reqUrl = new URL(req.url, 'http://localhost:8085');
      const code = reqUrl.searchParams.get('code');
      const error = reqUrl.searchParams.get('error');

      if (error) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(`<h1>Authorization Failed</h1><p>${error}</p>`);
        console.error(`\nAuthorization was denied: ${error}`);
        server.close();
        rl.close();
        return;
      }

      if (code) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(
          '<h1>Authorization Successful!</h1><p>You can close this browser window and check your terminal.</p>'
        );
        server.close();

        console.log('\nExchanging authorization code for permanent Refresh Token...');

        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
          }),
        });

        const tokenData = await tokenRes.json();

        if (!tokenRes.ok || !tokenData.refresh_token) {
          console.error('\nERROR: Failed to receive refresh token.');
          console.error(tokenData);
          rl.close();
          process.exit(1);
        }

        const refreshToken = tokenData.refresh_token;

        console.log('\n======================================================');
        console.log('🎉 REFRESH TOKEN GENERATED SUCCESSFULLY!');
        console.log('======================================================\n');
        console.log('Add the following line to your .env.local file:\n');
        console.log(`\x1b[32mGOOGLE_CLIENT_ID="${clientId}"\x1b[0m`);
        console.log(`\x1b[32mGOOGLE_CLIENT_SECRET="${clientSecret}"\x1b[0m`);
        console.log(`\x1b[32mGOOGLE_REFRESH_TOKEN="${refreshToken}"\x1b[0m\n`);
        console.log('And in GitHub Repository Secrets, add:');
        console.log('  - GOOGLE_CLIENT_ID');
        console.log('  - GOOGLE_CLIENT_SECRET');
        console.log('  - GOOGLE_REFRESH_TOKEN\n');

        rl.close();
        process.exit(0);
      }
    } catch (err) {
      console.error('Server error handling callback:', err);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error');
      server.close();
      rl.close();
    }
  });

  server.listen(8085, () => {});
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
