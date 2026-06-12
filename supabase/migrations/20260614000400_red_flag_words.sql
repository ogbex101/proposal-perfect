CREATE TABLE IF NOT EXISTS public.red_flag_words (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phrase text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS red_flag_words_user_idx ON public.red_flag_words (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.red_flag_words TO authenticated;
GRANT ALL ON public.red_flag_words TO service_role;

ALTER TABLE public.red_flag_words ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'red_flag_words'
      AND policyname = 'Users manage own red_flag_words'
  ) THEN
    CREATE POLICY "Users manage own red_flag_words"
      ON public.red_flag_words FOR ALL
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
