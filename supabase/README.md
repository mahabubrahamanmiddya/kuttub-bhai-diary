# Supabase Database Setup & Migration Guide

This application connects to Supabase as its primary cloud PostgreSQL database with strict Row Level Security (RLS).

## 1. Quick Setup in Supabase Dashboard

1. Create a new Supabase project at [supabase.com](https://supabase.com).
2. Go to the **SQL Editor** in your Supabase project dashboard.
3. Open `supabase/migrations/20261117_initial_schema.sql` and paste the entire script into the SQL Editor.
4. Click **Run**.
5. Go to **Project Settings** -> **API** to copy:
   - `Project URL` -> `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key -> `NEXT_PUBLIC_SUPABASE_ANON_KEY`
6. Add these to your `.env.local` file (see `.env.example`).

## 2. Authentication Configuration
- In Supabase Dashboard -> **Authentication** -> **Providers** -> **Email**:
  - Enable Email provider
  - Optionally turn off "Confirm email" during development if you want instant login upon signup.
- In Supabase Dashboard -> **Authentication** -> **URL Configuration**:
  - Set Site URL to `http://localhost:3000` (or your production domain).

## 3. Row Level Security (RLS)
Every table is locked down so that:
- Each user can only see, insert, update, and delete records belonging to their own business.
- Multi-tenant isolation is enforced at the PostgreSQL database level, impossible to bypass from the frontend.
