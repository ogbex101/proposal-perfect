-- Multi-profile support: each user can have up to 10 freelancer profiles
CREATE TABLE IF NOT EXISTS public.freelancer_profiles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label       text NOT NULL DEFAULT 'My Profile',     -- short display name e.g. "Web Dev"
  name        text,
  bio         text,
  avatar_url  text,                                    -- storage path (private bucket)
  skills      text[] NOT NULL DEFAULT '{}',
  is_active   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS freelancer_profiles_user_idx ON public.freelancer_profiles (user_id, created_at ASC);

-- Only 1 active profile per user (partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS freelancer_profiles_one_active
  ON public.freelancer_profiles (user_id)
  WHERE is_active = true;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.freelancer_profiles TO authenticated;
GRANT ALL ON public.freelancer_profiles TO service_role;

ALTER TABLE public.freelancer_profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'freelancer_profiles'
      AND policyname = 'own freelancer_profiles'
  ) THEN
    CREATE POLICY "own freelancer_profiles"
      ON public.freelancer_profiles
      FOR ALL
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Auto-update updated_at
DROP TRIGGER IF EXISTS freelancer_profiles_set_updated_at ON public.freelancer_profiles;
CREATE TRIGGER freelancer_profiles_set_updated_at
  BEFORE UPDATE ON public.freelancer_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
