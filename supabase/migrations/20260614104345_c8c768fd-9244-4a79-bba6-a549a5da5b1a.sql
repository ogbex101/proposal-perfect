DROP POLICY IF EXISTS "admin_read" ON public.page_views;
DROP POLICY IF EXISTS "anyone_insert" ON public.page_views;
REVOKE ALL PRIVILEGES ON TABLE public.page_views FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.page_views FROM authenticated;
GRANT SELECT ON TABLE public.page_views TO authenticated;
GRANT ALL ON TABLE public.page_views TO service_role;