-- ==============================================================================
-- MY DIARY - KEEP NOTES STYLE DIGITAL DIARY SCHEMA
-- Compatible with Supabase PostgreSQL with Row Level Security (RLS)
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. NOTES TABLE
CREATE TABLE IF NOT EXISTS public.notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT 'default',
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  is_checklist BOOLEAN NOT NULL DEFAULT false,
  reminder_date TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for lightning fast queries
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON public.notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON public.notes(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_pinned ON public.notes(user_id, is_pinned) WHERE is_deleted = false AND is_archived = false;
CREATE INDEX IF NOT EXISTS idx_notes_archived ON public.notes(user_id, is_archived) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_notes_deleted ON public.notes(user_id, is_deleted);

-- Full text search support for title and content
CREATE INDEX IF NOT EXISTS idx_notes_search ON public.notes USING gin(to_tsvector('simple', title || ' ' || content));

-- 2. LABELS TABLE
CREATE TABLE IF NOT EXISTS public.labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#f59e0b',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT unique_user_label_name UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_labels_user_id ON public.labels(user_id);

-- 3. NOTE_LABELS JUNCTION TABLE
CREATE TABLE IF NOT EXISTS public.note_labels (
  note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  label_id UUID NOT NULL REFERENCES public.labels(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (note_id, label_id)
);

CREATE INDEX IF NOT EXISTS idx_note_labels_note_id ON public.note_labels(note_id);
CREATE INDEX IF NOT EXISTS idx_note_labels_label_id ON public.note_labels(label_id);

-- 4. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.note_labels ENABLE ROW LEVEL SECURITY;

-- Notes Policies (strictly user-isolated)
CREATE POLICY "Users can view own notes"
  ON public.notes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notes"
  ON public.notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notes"
  ON public.notes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notes"
  ON public.notes FOR DELETE
  USING (auth.uid() = user_id);

-- Labels Policies
CREATE POLICY "Users can view own labels"
  ON public.labels FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own labels"
  ON public.labels FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own labels"
  ON public.labels FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own labels"
  ON public.labels FOR DELETE
  USING (auth.uid() = user_id);

-- Note Labels Policies (strictly validates ownership of both the note and the label)
CREATE POLICY "Users can view own note labels"
  ON public.note_labels FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.notes
      WHERE notes.id = note_labels.note_id
        AND notes.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.labels
      WHERE labels.id = note_labels.label_id
        AND labels.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can attach labels to own notes"
  ON public.note_labels FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.notes
      WHERE notes.id = note_labels.note_id
        AND notes.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.labels
      WHERE labels.id = note_labels.label_id
        AND labels.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own note labels"
  ON public.note_labels FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.notes
      WHERE notes.id = note_labels.note_id
        AND notes.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.labels
      WHERE labels.id = note_labels.label_id
        AND labels.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.notes
      WHERE notes.id = note_labels.note_id
        AND notes.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.labels
      WHERE labels.id = note_labels.label_id
        AND labels.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can remove labels from own notes"
  ON public.note_labels FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.notes
      WHERE notes.id = note_labels.note_id
        AND notes.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.labels
      WHERE labels.id = note_labels.label_id
        AND labels.user_id = auth.uid()
    )
  );

-- ==============================================================================
-- AUTOMATIC INITIAL SETUP ON USER SIGNUP
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user_setup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_biz_label UUID;
  v_cust_label UUID;
  v_exp_label UUID;
  v_note_id UUID;
BEGIN
  -- Insert default handy labels
  INSERT INTO public.labels (user_id, name, color)
  VALUES (new.id, 'Business', '#3B82F6')
  RETURNING id INTO v_biz_label;

  INSERT INTO public.labels (user_id, name, color)
  VALUES (new.id, 'Customers', '#10B981')
  RETURNING id INTO v_cust_label;

  INSERT INTO public.labels (user_id, name, color)
  VALUES (new.id, 'Expenses', '#EF4444')
  RETURNING id INTO v_exp_label;

  INSERT INTO public.labels (user_id, name, color)
  VALUES (new.id, 'Personal', '#8B5CF6');

  INSERT INTO public.labels (user_id, name, color)
  VALUES (new.id, 'Important', '#F59E0B');

  -- Create a warm welcome sample note
  INSERT INTO public.notes (
    user_id,
    title,
    content,
    is_pinned,
    color
  )
  VALUES (
    new.id,
    'Welcome to My Diary 📔',
    'Yeh aapki personal digital diary hai!\n\nYahan aap aasaani se:\n• Roz ka hisaab likh sakte hain (Raju - ₹5000 lena hai)\n• Customer details save kar sakte hain\n• Reminders aur checklist bana sakte hain\n\nSab kuch likhte hi automatically save hota hai.',
    true,
    'sand'
  )
  RETURNING id INTO v_note_id;

  -- Attach 'Important' and 'Business' to welcome note
  IF v_biz_label IS NOT NULL AND v_note_id IS NOT NULL THEN
    INSERT INTO public.note_labels (note_id, label_id)
    VALUES (v_note_id, v_biz_label)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created_diary ON auth.users;
CREATE TRIGGER on_auth_user_created_diary
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_setup();
