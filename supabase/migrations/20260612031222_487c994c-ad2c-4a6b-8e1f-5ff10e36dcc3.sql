
-- Storage policies for portfolio-assets (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='portfolio assets are publicly readable') THEN
    CREATE POLICY "portfolio assets are publicly readable" ON storage.objects FOR SELECT USING (bucket_id = 'portfolio-assets');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='users write own portfolio assets') THEN
    CREATE POLICY "users write own portfolio assets" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'portfolio-assets' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='users update own portfolio assets') THEN
    CREATE POLICY "users update own portfolio assets" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'portfolio-assets' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='users delete own portfolio assets') THEN
    CREATE POLICY "users delete own portfolio assets" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'portfolio-assets' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;

-- Table for AI-generated portfolios
CREATE TABLE IF NOT EXISTS public.generated_portfolios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  title text NOT NULL DEFAULT 'My Portfolio',
  niche text,
  job_excerpt text,
  data jsonb NOT NULL,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS generated_portfolios_user_idx ON public.generated_portfolios (user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.generated_portfolios TO authenticated;
GRANT ALL ON public.generated_portfolios TO service_role;
GRANT SELECT ON public.generated_portfolios TO anon;

ALTER TABLE public.generated_portfolios ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='generated_portfolios' AND policyname='own generated_portfolios all') THEN
    CREATE POLICY "own generated_portfolios all" ON public.generated_portfolios FOR ALL TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin')) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='generated_portfolios' AND policyname='published generated_portfolios are public') THEN
    CREATE POLICY "published generated_portfolios are public" ON public.generated_portfolios FOR SELECT TO anon, authenticated USING (is_published = true);
  END IF;
END $$;

DROP TRIGGER IF EXISTS generated_portfolios_set_updated_at ON public.generated_portfolios;
CREATE TRIGGER generated_portfolios_set_updated_at BEFORE UPDATE ON public.generated_portfolios FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
