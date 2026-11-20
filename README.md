# My Diary (Digital Diary & Keep Notes) 📔

A simple, clean **Keep Notes + Personal Diary web app** built for daily business notes, money-related hisaab, customer details, reminders, and general thoughts.

> **Design Philosophy**: Simplicity > Features. Feels like Google Keep + Personal Diary, **NOT** complicated accounting software.

---

## ✨ Features

- **Google Keep Style Notes**: Clean card layout with pastel Keep colors (Warm Sand, Peach, Coral, Mint, Sage, Sky, Lavender, Clay, White).
- **Auto-Save While Typing**:
  - Live status indicator: `Saving...` ➔ `Saved ✓` / `Saved to cloud ✓`.
  - Offline status: `Offline — changes will sync when you're back online`.
- **Business-Friendly Shortcuts**:
  - **₹ Rupee Symbol Button**: 1-click insert for fast hisaab.
  - **Today's Date Button**: 1-click formatted date insert.
  - **Checklists & Bullets**: Interactive checklists with strikethrough.
- **Organization**:
  - **📌 Pinned Notes**: Stay anchored at the top.
  - **All Notes**: Clean grid or list view.
  - **Archive**: Easily move finished notes off the main canvas.
  - **Trash**: Two-step deletion (Restore or Delete permanently).
  - **Labels / Categories**: Optional custom tags (Business, Customers, Expenses, Personal, Important).
- **Instant Search**: Search instantly across titles, content (e.g. `Raju`, `5000`), and labels.
- **Three-Layer Data Protection & Disaster Recovery**:
  - **Layer 1: IndexedDB**: Resilient local on-device database with offline editing, persistent queue, and conflict version preservation.
  - **Layer 2: Supabase PostgreSQL**: Primary cloud database with strict Row Level Security (RLS) isolation.
  - **Layer 3: Google Drive & GitHub Actions**: Automated daily backups to private Google Drive folder (`Digital Diary Backups`) running unattended via scheduled GitHub Actions.
- **Backup & Recovery Center**:
  - **Backup Now**: Instant Google Drive upload + downloadable verified `.json` file.
  - **Backup History**: View past snapshots, sizes, note counts, and cryptographic checksums.
  - **Safe Restoration Engine**: Restores from local JSON files or Google Drive with SHA-256 verification, Merge mode (default), or Replace mode (with automatic safety pre-backup).
  - **Decoupled Recovery**: Restore into a completely new Supabase project even if the original database was deleted years ago!
- **Note Version History**: Automatic and manual historical checkpoints to recover previous drafts without keystroke bloat.
- **PWA & Offline Support**:
  - Installable on mobile phones (iOS & Android) and desktop like a native app.
  - Works offline; synchronizes seamlessly without duplicate notes when reconnected.
- **Export & Backup**:
  - 1-click download as plain text (`.txt`) or full JSON (`.json`) backup.

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js 18+ (tested with Node 20 & 24)
- npm or pnpm

### 2. Installation
```bash
npm install
```

### 3. Supabase Setup (Optional for cloud sync)
1. Create a project at [supabase.com](https://supabase.com).
2. Run the SQL schema from [`supabase/migrations/20261119_initial_notes_schema.sql`](supabase/migrations/20261119_initial_notes_schema.sql) in the Supabase SQL Editor.
3. Add your credentials to `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   ```
*(If no Supabase keys are configured, the app automatically runs in instant offline / local mode!)*

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📱 Installing on Mobile (PWA)
1. Open the website on your phone browser (Safari on iOS, Chrome on Android).
2. Tap **Share** (iOS) or **Three dots ⋮** (Android).
3. Tap **"Add to Home Screen"**.
4. The app opens full-screen with offline support!
