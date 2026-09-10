-- Batch 7 — candidate strategy patterns.
-- When a job doesn't confidently match any existing pattern in the strategy library
-- (STRATEGIES in proposal-constants.ts), the system drafts a new pattern for that one
-- job and flags it here as a candidate for permanent addition to the library — only if
-- it's genuinely anchored to something the existing patterns couldn't handle (not a
-- reworded duplicate). Runs quietly in the background; never blocks generation.
-- Forward-dated + idempotent.

CREATE TABLE IF NOT EXISTS public.strategy_pattern_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL,
  anchored_to text NOT NULL DEFAULT '',   -- what existing patterns couldn't handle
  source_job_excerpt text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'candidate' CHECK (status IN ('candidate', 'accepted', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.strategy_pattern_candidates TO authenticated;
GRANT ALL ON public.strategy_pattern_candidates TO service_role;

ALTER TABLE public.strategy_pattern_candidates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own strategy candidates" ON public.strategy_pattern_candidates;
CREATE POLICY "Users manage own strategy candidates"
  ON public.strategy_pattern_candidates FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS strategy_pattern_candidates_set_updated_at ON public.strategy_pattern_candidates;
CREATE TRIGGER strategy_pattern_candidates_set_updated_at
  BEFORE UPDATE ON public.strategy_pattern_candidates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
