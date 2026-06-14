-- 1. Short strategy links — store strategy docs with a random 8-char slug
CREATE TABLE IF NOT EXISTS public.strategies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  slug text UNIQUE NOT NULL,
  doc jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS strategies_slug_idx ON public.strategies (slug);
CREATE INDEX IF NOT EXISTS strategies_user_idx ON public.strategies (user_id);
GRANT SELECT, INSERT, DELETE ON public.strategies TO authenticated;
GRANT ALL ON public.strategies TO service_role;
ALTER TABLE public.strategies ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='strategies' AND policyname='Users manage own strategies') THEN
    CREATE POLICY "Users manage own strategies" ON public.strategies FOR ALL
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
-- Allow anonymous reads so shareable links work without login
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='strategies' AND policyname='Public read strategies') THEN
    CREATE POLICY "Public read strategies" ON public.strategies FOR SELECT USING (true);
  END IF;
END $$;

-- 2. Drive link — standalone per profile, never inherited
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS drive_link text;
ALTER TABLE public.sub_profiles ADD COLUMN IF NOT EXISTS drive_link text;

-- 3. Conversation stages + deep learning
ALTER TABLE public.conversion_threads
  ADD COLUMN IF NOT EXISTS stage integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS context_dump text DEFAULT '',
  ADD COLUMN IF NOT EXISTS extracted jsonb DEFAULT '{}';
