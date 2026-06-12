
-- 1. Extend profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS whatsapp text,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS my_story text,
  ADD COLUMN IF NOT EXISTS skills text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS credentials jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS brands_worked text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS avatar_url text;

-- 2. custom_hooks
CREATE TABLE IF NOT EXISTS public.custom_hooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_hooks TO authenticated;
GRANT ALL ON public.custom_hooks TO service_role;

ALTER TABLE public.custom_hooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own custom_hooks all"
  ON public.custom_hooks
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER custom_hooks_set_updated_at
  BEFORE UPDATE ON public.custom_hooks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. custom_strategies
CREATE TABLE IF NOT EXISTS public.custom_strategies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_strategies TO authenticated;
GRANT ALL ON public.custom_strategies TO service_role;

ALTER TABLE public.custom_strategies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own custom_strategies all"
  ON public.custom_strategies
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER custom_strategies_set_updated_at
  BEFORE UPDATE ON public.custom_strategies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Storage policies for avatars bucket (bucket itself is created via tool)
CREATE POLICY "avatars are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "users upload own avatar folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "users update own avatar folder"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "users delete own avatar folder"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
