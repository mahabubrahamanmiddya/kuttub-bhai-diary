# Supabase Setup Guide for My Diary

Follow these simple steps to set up Supabase for **My Diary**:

### 1. Create a Supabase Project
1. Go to [https://supabase.com](https://supabase.com) and sign in.
2. Click **New Project**, choose a project name (e.g. `kuttub-bhai-diary`) and database password.
3. Choose your closest region (e.g. Mumbai `ap-south-1`).

### 2. Run the Database Schema
1. In the Supabase Dashboard, open the **SQL Editor** from the left navigation.
2. Click **New query**.
3. Copy the entire contents of [`migrations/20261119_initial_notes_schema.sql`](./migrations/20261119_initial_notes_schema.sql) and paste it into the editor.
4. Click **Run** (Cmd/Ctrl + Enter).

This creates:
- `notes` table with search indexes and automatic timestamp management
- `labels` table for custom tags
- `note_labels` junction table
- Row Level Security (RLS) policies so each user's notes are strictly private
- Auto-setup trigger that creates default labels (Business, Customers, Expenses, Personal, Important) and a starter welcome note for every new signup!

### 3. Configure Authentication
1. Go to **Authentication** > **Providers** in your Supabase Dashboard.
2. Ensure **Email** is enabled.
3. (Recommended for development/production quick testing): Under **Authentication** > **URL Configuration**, set Site URL to `http://localhost:3000` (or your production domain).
4. (Optional): You can disable "Confirm email" under Auth Settings if you want users to log in immediately without email confirmation.

### 4. Connect to Next.js
1. In Supabase Dashboard, go to **Project Settings** > **API**.
2. Copy the **Project URL** and the **anon public** API key.
3. In your project root, open `.env.local` and add:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   ```
4. Restart your development server:
   ```bash
   npm run dev
   ```

All notes will now autosave directly to Supabase PostgreSQL with full offline synchronization!
