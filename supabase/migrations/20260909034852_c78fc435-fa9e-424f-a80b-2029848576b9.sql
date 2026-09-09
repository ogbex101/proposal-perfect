CREATE TABLE IF NOT EXISTS public.proposal_structures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fingerprint text NOT NULL,
  blocks text[] NOT NULL DEFAULT '{}',
  golden_key_pattern text,
  occurrences integer NOT NULL DEFAULT 1,
  prompted_at_occurrence integer NOT NULL DEFAULT 0,
  saved_as_template boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, fingerprint)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposal_structures TO authenticated;
GRANT ALL ON public.proposal_structures TO service_role;

ALTER TABLE public.proposal_structures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own proposal_structures" ON public.proposal_structures;
CREATE POLICY "Users manage own proposal_structures"
  ON public.proposal_structures FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS proposal_structures_set_updated_at ON public.proposal_structures;
CREATE TRIGGER proposal_structures_set_updated_at
  BEFORE UPDATE ON public.proposal_structures
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();