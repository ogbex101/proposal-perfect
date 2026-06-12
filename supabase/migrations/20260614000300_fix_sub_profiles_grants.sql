-- Ensure sub_profiles table exists (idempotent) and has correct grants.
-- This migration fixes cases where the table was created without GRANT statements.

CREATE TABLE IF NOT EXISTS public.sub_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Sub Profile',
  name text,
  bio text,
  my_story text,
  skills text[] DEFAULT '{}',
  credentials jsonb DEFAULT '[]',
  brands_worked text[] DEFAULT '{}',
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sub_profiles_user_id_idx ON public.sub_profiles (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sub_profiles TO authenticated;
GRANT ALL ON public.sub_profiles TO service_role;

ALTER TABLE public.sub_profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'sub_profiles'
      AND policyname = 'Users manage own sub_profiles'
  ) THEN
    CREATE POLICY "Users manage own sub_profiles"
      ON public.sub_profiles
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Ensure niches column exists on profiles (idempotent)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS niches text[] DEFAULT '{}';
