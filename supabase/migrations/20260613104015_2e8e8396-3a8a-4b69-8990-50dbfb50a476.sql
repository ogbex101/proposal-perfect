ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS client_responded boolean,
  ADD COLUMN IF NOT EXISTS responded_at timestamptz;

CREATE INDEX IF NOT EXISTS proposals_response_analytics_idx
  ON public.proposals (user_id, client_responded, hook, strategy);

CREATE TABLE public.page_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path text NOT NULL,
  user_id uuid,
  fingerprint text,
  referrer text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.page_views TO authenticated;
GRANT ALL ON public.page_views TO service_role;

ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Administrators can view page analytics"
ON public.page_views
FOR SELECT
TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX page_views_created_at_idx ON public.page_views (created_at DESC);
CREATE INDEX page_views_user_id_idx ON public.page_views (user_id);
CREATE INDEX page_views_fingerprint_idx ON public.page_views (fingerprint);