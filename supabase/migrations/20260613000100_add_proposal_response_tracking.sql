
-- Phase 3: track whether the client responded to each proposal
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS client_responded boolean,
  ADD COLUMN IF NOT EXISTS responded_at timestamptz;

-- Index for fast analytics queries
CREATE INDEX IF NOT EXISTS proposals_responded_idx
  ON public.proposals (user_id, client_responded, hook, strategy);
