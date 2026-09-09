-- Re-apply migrations that were skipped as "out of order".
--
-- Investigation (Round 4 audit): the generated Supabase types show that new-table
-- migrations applied (app_settings, user_access, proposal_memory, proposal_structures)
-- but the ALTER TABLE ADD COLUMN migrations on the pre-existing portfolio_items table
-- (niche, niche_tags) never took effect, and the anon GRANT on strategies is unverifiable.
-- Root cause: those files carry timestamps EARLIER than an already-applied migration
-- (20260909034852...), so the migration runner treats them as historical and skips them.
--
-- This migration is FORWARD-DATED (after every existing one) and fully idempotent, so it
-- is picked up as a new pending migration and applies cleanly regardless of current state.

-- Fix 9 (portfolio-to-niche tagging) — the app reads/writes these columns.
ALTER TABLE public.portfolio_items
  ADD COLUMN IF NOT EXISTS niche text,
  ADD COLUMN IF NOT EXISTS niche_tags text[] NOT NULL DEFAULT '{}';

-- Fix 1 (public strategy share links) — anon needs table-level SELECT; RLS still
-- restricts writes to the owning user. Re-granting is a no-op if already present.
GRANT SELECT ON public.strategies TO anon;
