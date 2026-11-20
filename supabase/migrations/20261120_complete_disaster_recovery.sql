-- ==============================================================================
-- DIGITAL DIARY: COMPLETE DATA PROTECTION, BACKUP AND DISASTER RECOVERY
-- Migration: 20261120_complete_disaster_recovery.sql
-- Compatible with Supabase PostgreSQL with Row Level Security (RLS)
-- ==============================================================================

-- 1. NOTE VERSIONS TABLE (Immutable historical checkpoints)
CREATE TABLE IF NOT EXISTS public.note_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT 'default',
  is_checklist BOOLEAN NOT NULL DEFAULT false,
  version_number INT NOT NULL DEFAULT 1,
  change_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for fast version lookups
CREATE INDEX IF NOT EXISTS idx_note_versions_note_id ON public.note_versions(note_id);
CREATE INDEX IF NOT EXISTS idx_note_versions_user_id ON public.note_versions(user_id);
CREATE INDEX IF NOT EXISTS idx_note_versions_created_at ON public.note_versions(created_at DESC);

-- Enable RLS on note_versions
ALTER TABLE public.note_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own note versions" ON public.note_versions;
CREATE POLICY "Users can view own note versions"
  ON public.note_versions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own note versions" ON public.note_versions;
CREATE POLICY "Users can insert own note versions"
  ON public.note_versions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own note versions" ON public.note_versions;
CREATE POLICY "Users can delete own note versions"
  ON public.note_versions FOR DELETE
  USING (auth.uid() = user_id);

-- 2. BACKUPS METADATA TABLE (Tracks backup integrity, history and verification)
CREATE TABLE IF NOT EXISTS public.backups_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  storage_location TEXT NOT NULL CHECK (storage_location IN ('google_drive', 'local_download', 'github_actions', 'manual_export')),
  file_size_bytes BIGINT NOT NULL DEFAULT 0,
  notes_count INT NOT NULL DEFAULT 0,
  labels_count INT NOT NULL DEFAULT 0,
  checksum_sha256 TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('verified', 'success', 'failed')),
  drive_file_id TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for backup history
CREATE INDEX IF NOT EXISTS idx_backups_user_id ON public.backups_metadata(user_id);
CREATE INDEX IF NOT EXISTS idx_backups_created_at ON public.backups_metadata(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_backups_checksum ON public.backups_metadata(checksum_sha256);

-- Enable RLS on backups_metadata
ALTER TABLE public.backups_metadata ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own backups metadata" ON public.backups_metadata;
CREATE POLICY "Users can view own backups metadata"
  ON public.backups_metadata FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own backups metadata" ON public.backups_metadata;
CREATE POLICY "Users can insert own backups metadata"
  ON public.backups_metadata FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own backups metadata" ON public.backups_metadata;
CREATE POLICY "Users can update own backups metadata"
  ON public.backups_metadata FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own backups metadata" ON public.backups_metadata;
CREATE POLICY "Users can delete own backups metadata"
  ON public.backups_metadata FOR DELETE
  USING (auth.uid() = user_id);

-- 3. AUTOMATIC NOTE VERSION CHECKPOINT TRIGGER
-- Safely saves a version checkpoint when significant edits occur (avoids keystroke spam)
CREATE OR REPLACE FUNCTION public.handle_note_version_checkpoint()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_last_version_at TIMESTAMPTZ;
  v_next_version_num INT;
BEGIN
  -- Only trigger if title or content meaningfully changed
  IF (OLD.title IS DISTINCT FROM NEW.title) OR (OLD.content IS DISTINCT FROM NEW.content) THEN
    -- Check when the last version was created for this note
    SELECT created_at, version_number
    INTO v_last_version_at, v_next_version_num
    FROM public.note_versions
    WHERE note_id = OLD.id
    ORDER BY created_at DESC
    LIMIT 1;

    -- If no previous version, start at 1; otherwise increment
    v_next_version_num := COALESCE(v_next_version_num, 0) + 1;

    -- Only create a new checkpoint if at least 5 minutes have elapsed since last checkpoint,
    -- or if there is no previous version at all.
    IF v_last_version_at IS NULL OR (NOW() - v_last_version_at) > INTERVAL '5 minutes' THEN
      INSERT INTO public.note_versions (
        note_id,
        user_id,
        title,
        content,
        color,
        is_checklist,
        version_number,
        change_summary,
        created_at
      )
      VALUES (
        OLD.id,
        OLD.user_id,
        OLD.title,
        OLD.content,
        OLD.color,
        OLD.is_checklist,
        v_next_version_num,
        'Auto checkpoint before update',
        OLD.updated_at
      );
    END IF;
  END IF;

  -- Update note updated_at timestamp
  NEW.updated_at := timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_note_version_checkpoint ON public.notes;
CREATE TRIGGER trg_note_version_checkpoint
  BEFORE UPDATE ON public.notes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_note_version_checkpoint();
