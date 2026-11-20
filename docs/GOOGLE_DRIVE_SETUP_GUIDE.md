# Google Drive Automated Backup Setup Guide 📂

This guide provides beginner-friendly, step-by-step instructions to connect Google Drive with your Digital Diary application for **unattended daily automated backups**.

---

## 💡 How It Works
- A Google Cloud **Service Account** acts as an authorized bot.
- Daily backups run unattended in the cloud via **GitHub Actions** (even when your phone or laptop is turned off).
- Backups are stored in a private folder named **`Digital Diary Backups`** in Google Drive.
- Each backup file is timestamped: `diary-backup-YYYY-MM-DD-HH-MM-SS.json`.

---

## 🛠️ Step 1: Create a Google Cloud Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Log in with your standard Google / Gmail account.
3. At the top of the page, click the project dropdown and click **"New Project"**.
4. Name the project: `Digital Diary Backup`.
5. Click **Create** and wait a few seconds until the project is ready.

---

## 🔌 Step 2: Enable the Google Drive API

1. In the Google Cloud Console, use the top search bar to search for: **`Google Drive API`**.
2. Click on **Google Drive API** in the results.
3. Click the blue **"Enable"** button.

---

## 🔑 Step 3: Create a Service Account & Download Key

1. In the left navigation menu, go to **IAM & Admin** > **Service Accounts**.
2. Click **"+ Create Service Account"** at the top.
3. Enter:
   - **Service account name**: `diary-backup-runner`
   - **Service account ID**: (auto-filled)
   - **Description**: `Unattended daily backup runner for Digital Diary`
4. Click **Create and Continue**.
5. (Optional) For Role, select **Basic** > **Editor** (or leave default).
6. Click **Done**.
7. In the Service Accounts list, click on the three dots **⋮** next to your newly created service account and select **"Manage keys"**.
8. Click **"Add Key"** > **"Create new key"**.
9. Choose **JSON** and click **Create**.
10. A `.json` file will automatically download to your computer.
    *Keep this file secure! It contains the credentials for the backup runner.*

---

## 📂 Step 4: (Optional) Share a Drive Folder with the Service Account

If you want the backups to appear directly inside your personal Google Drive account:
1. Open [Google Drive](https://drive.google.com).
2. Create a folder named: **`Digital Diary Backups`**.
3. Right-click the folder > **Share**.
4. Paste the Service Account's email address (found in your JSON key file under `"client_email"`, ending with `@...gserviceaccount.com`).
5. Grant it **Editor** permissions and click **Send**.

---

## ⚙️ Step 5: Configure Environment Variables

### For Local Development or Server:
Open `.env.local` and add:
```env
# Paste the entire content of the downloaded JSON key file as a single line:
GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"..."}'
```

### For GitHub Actions Scheduled Backups:
1. Go to your GitHub repository: `https://github.com/<your-username>/kuttub-bhai-diary`.
2. Click **Settings** > **Secrets and variables** > **Actions**.
3. Click **"New repository secret"**.
4. Add the following secrets:
   - `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase Project URL (`https://xyz.supabase.co`).
   - `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase Service Role key (from Supabase Dashboard > Project Settings > API).
   - `GOOGLE_SERVICE_ACCOUNT_KEY`: Paste the entire content of the downloaded Google JSON key file.
5. Click **Add secret**.

---

## ✅ Step 6: Verify the Integration

1. Go to the **Actions** tab in your GitHub repository.
2. Select **"Daily Digital Diary Backup"** from the left sidebar.
3. Click **"Run workflow"** > **"Run workflow"** button.
4. The workflow will run and execute `scripts/run-daily-backup.mjs`.
5. Check your Google Drive folder: `Digital Diary Backups`. You will see your first timestamped file:
   `diary-backup-YYYY-MM-DD-HH-MM-SS.json`!
