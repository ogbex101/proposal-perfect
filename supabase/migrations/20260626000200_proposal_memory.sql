-- Proposal Memory: tracks each proposal generation for learning over time
CREATE TABLE IF NOT EXISTS public.proposal_memory (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at    timestamptz DEFAULT now(),

  -- Intelligence snapshot
  client_type   text,              -- e.g. "startup_founder", "agency", "enterprise"
  platform      text,              -- e.g. "upwork", "freelancer", "direct"
  detected_niche text,

  -- Strategy used
  primary_strategy text,           -- from ProposalBlueprintSchema.primaryStrategy
  hook_id       text,
  strategy_id   text,
  cta_id        text,

  -- Generated content snapshots
  opening_line  text,
  cta_line      text,

  -- Intelligence confidence
  overall_confidence numeric(5,2),
  required_human_review boolean DEFAULT false,

  -- Outcome (filled in later via markMemoryOutcome)
  outcome       text CHECK (outcome IN ('won', 'lost', 'no_response', 'pending')),
  outcome_note  text,
  outcome_at    timestamptz,

  -- Raw job excerpt for reference (trimmed)
  job_excerpt   text
);

ALTER TABLE public.proposal_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own memories" ON public.proposal_memory
  FOR ALL USING (auth.uid() = user_id);

-- Admins can read all memories (for aggregate insights)
CREATE POLICY "Admins read all memories" ON public.proposal_memory
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

GRANT ALL ON public.proposal_memory TO service_role;
