# Personal Google Drive Automated Backup Setup Guide (OAuth 2.0) 📂

This guide provides step-by-step instructions for connecting your **free personal Gmail / Google Drive account** (`@gmail.com`) using **Google OAuth 2.0 with offline access and refresh tokens**.

---

## 🌟 Why OAuth 2.0 with Refresh Tokens for Personal Accounts?
- **Personal Storage**: Backups upload directly into your personal Google Drive account in a dedicated folder named **`Digital Diary Backups`**.
- **100% Free**: Operates entirely within standard Google Drive free tier (15 GB).
- **Unattended & Automated**: Backups run daily via GitHub Actions without requiring your browser or computer to be open.
- **Privacy & Security**: Only requests permission to manage files created by this application (`https://www.googleapis.com/auth/drive.file`). It cannot access your other personal Google Drive documents or photos.

---

## 🛠️ Step 1: Create a Google Cloud Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Log in with your personal Google / Gmail account.
3. At the top of the page, click the project dropdown and click **"New Project"**.
4. Project name: `Digital Diary Backup`.
5. Click **Create** and wait a few seconds.

---

## 🔌 Step 2: Enable the Google Drive API

1. In the Google Cloud Console, search for **`Google Drive API`** in the top search bar.
2. Click on **Google Drive API** in the results.
3. Click the blue **"Enable"** button.

---

## 👤 Step 3: Configure the OAuth Consent Screen

> [!IMPORTANT]
> To prevent Google from expiring your refresh token after 7 days, follow this step carefully.

1. In the left navigation, go to **APIs & Services** > **OAuth consent screen**.
2. Select **External** and click **Create**.
3. Fill in:
   - **App name**: `Digital Diary`
   - **User support email**: Select your Gmail address
   - **Developer contact email**: Enter your Gmail address
4. Click **Save and Continue**.
5. Under **Scopes**, click **Add or Remove Scopes**:
   - Filter and select: `https://www.googleapis.com/auth/drive.file`
   - Click **Update** then **Save and Continue**.
6. Under **Test users**:
   - Click **"+ Add Users"** and type your personal Gmail address.
   - Click **Save and Continue**.
7. Under **Publishing Status**:
   - By default, Google marks external apps as **"Testing"** (which causes refresh tokens to expire after 7 days).
   - Click **"Publish App"** to set the publishing status to **"In production"**.
   - *(Note: For personal use with your own Google account, no verification is required. Unverified apps in production can access your personal account indefinitely without the 7-day expiration!)*

---

## 🔑 Step 4: Create OAuth 2.0 Client ID Credentials

1. In the left navigation, go to **APIs & Services** > **Credentials**.
2. Click **"+ Create Credentials"** at the top and select **"OAuth client ID"**.
3. Application type: Select **"Web application"**.
4. Name: `Digital Diary Web Client`.
5. Under **Authorized redirect URIs**, click **"+ Add URI"** and enter:
   - `http://localhost:3000/api/auth/google/callback`
   - `http://localhost:8085` (for terminal helper)
   - *(If deploying to Vercel, also add: `https://your-domain.vercel.app/api/auth/google/callback`)*
6. Click **Create**.
7. A dialog will display:
   - **Client ID** (e.g. `123456789-abc.apps.googleusercontent.com`)
   - **Client Secret** (e.g. `GOCSPX-xyz123...`)
8. Copy both values.

---

## ⚡ Step 5: Generate Your Google OAuth Refresh Token

You can generate your refresh token in either of two ways:

### Option A: Using the Terminal Helper (Fastest & Easiest)
Run this command in your project directory:
```bash
node scripts/get-google-refresh-token.mjs
```
1. Paste your `Client ID` and `Client Secret` when prompted.
2. It prints an authorization URL. Open it in your browser.
3. Select your Google account and click **"Continue"**.
4. The terminal immediately outputs your offline **`GOOGLE_REFRESH_TOKEN`**!

### Option B: Using the In-App Web Flow (Development Only)
1. Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to your `.env.local`.
2. Start the app: `npm run dev`.
3. Open `http://localhost:3000`, go to **Settings** > **Backup & Sync** > click **"Connect Google Drive"** (or open `http://localhost:3000/api/auth/google/authorize`).
4. Authorize with your Google account.
5. A confirmation screen appears with your **Refresh Token** and a 1-click **Copy** button.
*(Note: For security reasons, this route is disabled in production environments).*

---

## 🔐 Step 6: Save Credentials in `.env.local`, Vercel & GitHub Secrets

### In `.env.local` (Local Development):
```env
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-client-secret"
GOOGLE_REFRESH_TOKEN="1//04your-offline-refresh-token..."
```

### In GitHub Repository Secrets (Automated Daily Backups):
*(For unattended daily backups via GitHub Actions)*
1. Go to your GitHub repository > **Settings** > **Secrets and variables** > **Actions**.
2. Add:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REFRESH_TOKEN`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

---

## 🔒 Security Best Practices: Production vs Preview Deployments

> [!WARNING]
> **Never add production OAuth refresh tokens or Supabase service role keys to unauthenticated preview deployments!**
> 
> - **Preview Environment Isolation**: Vercel preview URLs (e.g. `kuttub-bhai-diary-git-feature-*.vercel.app`) are publicly reachable by default if SSO is not enabled. If production secrets are assigned to the "Preview" environment scope, any person opening a preview link could potentially trigger backups or read metadata.
> - **Recommended Scope Configuration in Vercel**:
>   - Set sensitive secrets (`GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`) strictly for the **Production** environment.
>   - Leave them unassigned or assign dedicated staging/mock credentials for **Preview** and **Development** environments.

---

## 🛡️ Backup Confidentiality vs. SHA-256 Integrity Verification

> [!IMPORTANT]
> **Understanding SHA-256 vs Encryption**:
> - **SHA-256 is an Integrity Check, NOT Encryption**: The SHA-256 checksum generated during backup creation provides cryptographic proof that the backup payload was not altered, truncated, corrupted, or tampered with in transit or storage. It **does not** encrypt the payload contents.
> - **Confidentiality & Access Control**: Backup JSON payloads are stored in your personal Google Drive in the `Digital Diary Backups` folder. Confidentiality is enforced by Google's OAuth 2.0 access control (restricted to the user's account and the app's scoped credentials) and Google Cloud's server-side encryption at rest. If client-side end-to-end payload encryption is ever desired in future releases, it should use AES-GCM-256 with a user-held passphrase separate from the SHA-256 integrity hash.

---

## ⚠️ Refresh Token Lifecycle, Inactivity & Expiration Risks

> [!CAUTION]
> **Google OAuth refresh tokens are NOT permanent.** They can expire or be revoked under any of the following circumstances:

1. **Consent Screen in "Testing" Mode (7-Day Expiration)**:
   - If your OAuth consent screen is left with Publishing Status = **"Testing"**, Google automatically expires all issued refresh tokens after **7 days**, regardless of usage.
   - **Remedy**: Go to Google Cloud Console > **APIs & Services** > **OAuth consent screen** and click **"Publish App"** to set Publishing Status to **"In production"**. Personal use does not require Google verification.
2. **6-Month Inactivity Rule**:
   - A refresh token expires if it is not exchanged for a fresh access token for **6 consecutive months**. Daily scheduled backups via GitHub Actions prevent inactivity expiration by refreshing tokens daily.
3. **Password Changes & Security Resets**:
   - Changing your Google Account password automatically revokes all existing refresh tokens associated with that account. You must re-run `node scripts/get-google-refresh-token.mjs` to obtain a new token.
4. **User-Initiated Revocation**:
   - If you disconnect the app in [Google Account Security Permissions](https://myaccount.google.com/permissions), the token is immediately invalidated.
5. **Token Count Limit**:
   - Google enforces a limit of 100 active refresh tokens per Google Account per OAuth client ID. Generating more than 100 tokens causes the oldest token to silently expire.
6. **Revocation Detection in Application**:
   - If authorization fails with `invalid_grant` ("Token has been expired or revoked"), the application flags the status as **"⚠️ Authorization Expired"** and prompts for re-authorization.
