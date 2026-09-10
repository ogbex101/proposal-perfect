-- Batch 3 — per-niche four-part portfolio templates.
-- Each niche (email marketing, video editing, social media, …) gets ONE reusable
-- four-part template (Situation / Approach / Visual direction / Takeaway). When a
-- portfolio piece is generated the four slots are repopulated with job-specific
-- specifics; if no template exists for the niche yet, one is built and saved here.
-- Forward-dated + idempotent so an out-of-order-skipping deploy pipeline can't miss it.

CREATE TABLE IF NOT EXISTS public.niche_portfolio_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  niche text NOT NULL,
  situation_guidance text NOT NULL DEFAULT '',
  approach_guidance text NOT NULL DEFAULT '',
  visual_direction text NOT NULL DEFAULT '',
  takeaway_guidance text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, niche)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.niche_portfolio_templates TO authenticated;
GRANT ALL ON public.niche_portfolio_templates TO service_role;

ALTER TABLE public.niche_portfolio_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own niche templates" ON public.niche_portfolio_templates;
CREATE POLICY "Users manage own niche templates"
  ON public.niche_portfolio_templates FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS niche_portfolio_templates_set_updated_at ON public.niche_portfolio_templates;
CREATE TRIGGER niche_portfolio_templates_set_updated_at
  BEFORE UPDATE ON public.niche_portfolio_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
