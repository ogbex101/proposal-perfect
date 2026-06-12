
-- Move has_role out of the PostgREST-exposed public schema
CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

REVOKE EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;

-- Repoint every policy that used public.has_role to private.has_role
DROP POLICY IF EXISTS "own custom_hooks all" ON public.custom_hooks;
CREATE POLICY "own custom_hooks all" ON public.custom_hooks FOR ALL TO authenticated
  USING ((auth.uid() = user_id) OR private.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own custom_strategies all" ON public.custom_strategies;
CREATE POLICY "own custom_strategies all" ON public.custom_strategies FOR ALL TO authenticated
  USING ((auth.uid() = user_id) OR private.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own generated_portfolios all" ON public.generated_portfolios;
CREATE POLICY "own generated_portfolios all" ON public.generated_portfolios FOR ALL TO authenticated
  USING ((auth.uid() = user_id) OR private.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own profile select" ON public.profiles;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated
  USING ((auth.uid() = id) OR private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "own portfolio all" ON public.portfolio_items;
CREATE POLICY "own portfolio all" ON public.portfolio_items FOR ALL TO authenticated
  USING ((auth.uid() = user_id) OR private.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own proposals all" ON public.proposals;
CREATE POLICY "own proposals all" ON public.proposals FOR ALL TO authenticated
  USING ((auth.uid() = user_id) OR private.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own saved all" ON public.saved_items;
CREATE POLICY "own saved all" ON public.saved_items FOR ALL TO authenticated
  USING ((auth.uid() = user_id) OR private.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own conv all" ON public.conversion_messages;
CREATE POLICY "own conv all" ON public.conversion_messages FOR ALL TO authenticated
  USING ((auth.uid() = user_id) OR private.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id);

-- Drop the public-schema version now that nothing references it
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
