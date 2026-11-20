# Digital Diary — Disaster Recovery & Multi-Year Restoration Guide 🛡️

This guide outlines the step-by-step procedure for recovering all your diary notes, checklists, labels, and hisaab entries in the event that your original database becomes unavailable, paused, corrupted, or permanently deleted years down the road.

---

## 🎯 Target Scenario: Recovery After Several Years

> **Scenario**:
> You created notes and hisaab entries in **2026**.
> You stopped using the application for several years.
> The original Supabase project was deleted due to inactivity or closure.
> In **2030+**, you want to access all your business records again.

Because the system was built with **Decoupled Identity & Standalone Backups**, your data is never locked into any single database ID, vendor account, or project URL.

---

## 📋 The 4-Step Complete Recovery Workflow

### Step 1: Obtain Your Independent Backup File
You can retrieve your backup file from any of the following independent locations:
1. **Google Drive**:
   - Open your Google Drive: [https://drive.google.com](https://drive.google.com)
   - Locate the private folder: `Digital Diary Backups`
   - Download the most recent (or desired historical) backup file:
     `diary-backup-YYYY-MM-DD-HH-MM-SS.json`
2. **Local Device Downloads**:
   - Any JSON backup file downloaded via the **"Backup Now"** button on your laptop or phone.

---

### Step 2: Set Up a Fresh Supabase Project (Takes ~2 minutes)
If your old Supabase project was deleted:
1. Go to [https://supabase.com](https://supabase.com) and create a free account or log in.
2. Click **"New Project"**, choose an organization and set a database password.
3. Open the **SQL Editor** from the left navigation.
4. Copy and paste the complete consolidated schema from:
   [`supabase/migrations/20261119_initial_notes_schema.sql`](../supabase/migrations/20261119_initial_notes_schema.sql)
   and
   [`supabase/migrations/20261120_complete_disaster_recovery.sql`](../supabase/migrations/20261120_complete_disaster_recovery.sql)
5. Click **Run**.
   *(This creates the `notes`, `labels`, `note_labels`, `note_versions`, and `backups_metadata` tables with Row Level Security).*

---

### Step 3: Connect Application to the New Project
1. In your new Supabase project dashboard, navigate to **Project Settings** > **API**.
2. Copy your **Project URL** and **anon public** API key.
3. Update your `.env.local` (or hosting environment variables on Vercel):
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://<your-new-project>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-new-anon-key>
   ```
4. Start or deploy the application:
   ```bash
   npm run dev
   # or deploy to Vercel
   ```

---

### Step 4: Log In and Restore Your Notes
1. Open the application in your browser.
2. Click **Sign In** and create your new account (or sign in with your email).
3. Open **Settings** (⚙️ icon in top-right or mobile bottom navigation).
4. Go to the **"Restore Backup"** tab.
5. Click **"Select JSON File"** and upload your downloaded `diary-backup-*.json` file.
6. The system automatically performs pre-restoration checks:
   - ✅ **Validates format**: Verifies v2.0 JSON structure.
   - ✅ **Verifies SHA-256 Checksum**: Confirms zero file corruption.
   - ✅ **Displays recoverable count**: Shows number of notes & labels in the backup.
7. Choose your restoration mode:
   - **Merge with existing notes (Recommended)**: Combines imported notes with any local notes.
   - **Replace existing notes**: Overwrites notes after automatically taking a safety pre-backup.
8. Click **Restore Notes Now**.

All your notes, hisaab amounts, dates, checklists, colors, and labels are remapped to your new user account and synced directly to your new PostgreSQL cloud database!

---

## 🔒 Verification & Data Safety Guarantees

1. **User ID Decoupling**:
   - The backup restoration engine dynamically remaps legacy user IDs to your currently authenticated user ID (`auth.uid()`).
   - You will never be locked out because of an old or inaccessible email address.

2. **Automatic Safety Pre-Backup**:
   - Before executing any destructive "Replace" restoration, the application automatically snapshots your current device data and verifies its SHA-256 checksum so no existing work can ever be accidentally erased.

3. **Conflict Resolution & Non-Destructive Merging**:
   - If a note was modified offline and conflicts with an incoming version, the system creates a tagged conflict copy (`Conflicted Local Copy`) and preserves the previous version in note history.

4. **Cryptographic Tamper-Proofing**:
   - Every backup payload includes an integrity checksum generated using **SHA-256**.
   - If a file is incomplete, damaged, or edited improperly, the restoration engine rejects it upfront and displays an explicit error message before any database modifications occur.
