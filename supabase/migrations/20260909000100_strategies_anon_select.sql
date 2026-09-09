-- Fix 1 — public strategy share links (/s/{slug}) return nothing for logged-out visitors.
--
-- The strategies table has a correct RLS policy allowing public SELECT
-- ("Public read strategies" ... USING (true)), but table-level SELECT was only
-- granted to `authenticated`. Postgres checks the GRANT before RLS, so anonymous
-- requests (the public share page uses the anon key) are blocked at the permission
-- layer regardless of the policy. Grant SELECT to anon so the RLS policy governs.
--
-- SELECT only — writes stay restricted to the owning user by the existing RLS policy.
GRANT SELECT ON public.strategies TO anon;
