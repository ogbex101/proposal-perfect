-- Conversion chat threads (one per client conversation)
CREATE TABLE IF NOT EXISTS public.conversion_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Untitled conversation',
  job_description text NOT NULL DEFAULT '',
  sent_proposal text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conversion_threads_user_idx ON public.conversion_threads (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversion_threads TO authenticated;
GRANT ALL ON public.conversion_threads TO service_role;

ALTER TABLE public.conversion_threads ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'conversion_threads'
      AND policyname = 'Users manage own conversion_threads'
  ) THEN
    CREATE POLICY "Users manage own conversion_threads"
      ON public.conversion_threads FOR ALL
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Messages inside a thread (alternating client → you → client → ...)
CREATE TABLE IF NOT EXISTS public.conversion_thread_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.conversion_threads(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('client', 'you')),
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conversion_thread_messages_thread_idx ON public.conversion_thread_messages (thread_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversion_thread_messages TO authenticated;
GRANT ALL ON public.conversion_thread_messages TO service_role;

ALTER TABLE public.conversion_thread_messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'conversion_thread_messages'
      AND policyname = 'Users manage own conversion_thread_messages'
  ) THEN
    CREATE POLICY "Users manage own conversion_thread_messages"
      ON public.conversion_thread_messages FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.conversion_threads t
          WHERE t.id = thread_id AND t.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.conversion_threads t
          WHERE t.id = thread_id AND t.user_id = auth.uid()
        )
      );
  END IF;
END $$;
