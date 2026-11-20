# GitHub Actions Scheduled Backup Guide ⏱️

This guide explains how the unattended daily backup workflow runs in GitHub Actions to safeguard your diary notes every single day without requiring your phone or laptop to be powered on.

---

## 📅 Schedule & Execution

The workflow file is located at:
[`.github/workflows/daily-backup.yml`](../.github/workflows/daily-backup.yml)

### Triggers:
1. **Automatic Cron Schedule**:
   - `cron: '0 2 * * *'`
   - Runs every day at **02:00 UTC** (which corresponds to **07:30 AM IST**).
   - Entirely free under GitHub's standard public and private repository free tier quotas.
2. **Manual On-Demand (`workflow_dispatch`)**:
   - You can trigger an instant cloud backup anytime from the GitHub website by visiting **Actions** > **Daily Digital Diary Backup** > **Run workflow**.

---

## 🔐 Required Secrets in GitHub

Go to: **GitHub Repository** > **Settings** > **Secrets and variables** > **Actions** > **Repository secrets**.

| Secret Name | Description | Where to find it |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL | Supabase Dashboard > Settings > API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Key | Supabase Dashboard > Settings > API > `service_role` (Secret) |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Entire Google Service Account JSON | Downloaded JSON file from Google Cloud IAM |

---

## 🛡️ Built-In Protections in the Automated Runner

The script [`scripts/run-daily-backup.mjs`](../scripts/run-daily-backup.mjs) incorporates strict data protection guardrails:

1. **Empty Database Abort Check**:
   - If the database returns 0 notes, but Google Drive already contains historical backups, the script **aborts immediately** with an error.
   - It will **NEVER** overwrite your valid existing backups with an empty file caused by a paused or unreachable database.

2. **Cryptographic Checksum Verification**:
   - The backup computes a **SHA-256** checksum of all notes, checklists, colors, and labels.
   - It writes the checksum directly into the backup metadata.

3. **Retention Policy (Smart Pruning)**:
   - Preserves all backups from the last 7 days.
   - Keeps 1 backup per week for the last 30 days.
   - Keeps 1 backup per month for older records.
   - **Critical Rule**: NEVER deletes the only existing valid backup.

---

## 🔍 How to Monitor Backups

1. Visit your repository on GitHub.
2. Click on the **Actions** tab.
3. Every green checkmark `✓` indicates a verified daily snapshot uploaded to Google Drive.
4. Click on any run to inspect the detailed log output (number of notes backed up, file size, SHA-256 hash, and Drive file ID).
