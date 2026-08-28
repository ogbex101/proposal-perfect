-- Portfolio niche/skill tags (Fix 9 — portfolio-to-niche tagging).
-- The app already reads/writes niche_tags, but the column was never created.
-- Each portfolio item can carry multiple freeform skill/niche tags used to
-- auto-match the right portfolio link(s) to a detected job niche.
ALTER TABLE public.portfolio_items
  ADD COLUMN IF NOT EXISTS niche_tags text[] NOT NULL DEFAULT '{}';
