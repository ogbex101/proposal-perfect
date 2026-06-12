
-- 1. Default new generated_portfolios to unpublished
ALTER TABLE public.generated_portfolios ALTER COLUMN is_published SET DEFAULT false;

-- 2. Defense-in-depth: explicit restrictive deny on user_roles writes for non-service roles
CREATE POLICY "deny role writes to clients (insert)"
  ON public.user_roles AS RESTRICTIVE FOR INSERT
  TO anon, authenticated
  WITH CHECK (false);

CREATE POLICY "deny role writes to clients (update)"
  ON public.user_roles AS RESTRICTIVE FOR UPDATE
  TO anon, authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY "deny role writes to clients (delete)"
  ON public.user_roles AS RESTRICTIVE FOR DELETE
  TO anon, authenticated
  USING (false);

-- 3. Lock down has_role function from direct API exposure.
-- RLS policies invoke it as the caller role, so authenticated still needs EXECUTE.
-- Revoke from PUBLIC and anon so anonymous PostgREST RPC cannot probe roles.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
