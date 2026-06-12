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

ALTER TABLE public.sub_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own sub_profiles"
  ON public.sub_profiles
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS sub_profiles_user_id_idx ON public.sub_profiles (user_id);
