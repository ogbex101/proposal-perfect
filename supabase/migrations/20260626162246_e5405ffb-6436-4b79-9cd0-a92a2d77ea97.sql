-- Remove public anon SELECT on strategies and portfolio_samples; server fns use admin client to read by slug
DROP POLICY IF EXISTS "Public read strategies" ON public.strategies;
DROP POLICY IF EXISTS "Public read portfolio_samples" ON public.portfolio_samples;

-- Outreach templates: enforce user_id NOT NULL so anon never sees orphaned rows
ALTER TABLE public.outreach_templates ALTER COLUMN user_id SET NOT NULL;