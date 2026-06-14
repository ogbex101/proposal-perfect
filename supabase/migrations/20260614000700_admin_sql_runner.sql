-- Admin SQL runner function (service_role only)
CREATE OR REPLACE FUNCTION public.run_admin_sql(sql text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  EXECUTE 'SELECT jsonb_agg(row_to_json(t)) FROM (' || sql || ') t' INTO result;
  RETURN COALESCE(result, '[]'::jsonb);
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION '%', SQLERRM;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.run_admin_sql(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.run_admin_sql(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.run_admin_sql(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.run_admin_sql(text) TO service_role;

-- Follow-up reminder on conversation threads
ALTER TABLE public.conversion_threads ADD COLUMN IF NOT EXISTS reminder_at timestamptz;
