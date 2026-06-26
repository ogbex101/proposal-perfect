-- App-wide settings (access code, etc.)
CREATE TABLE IF NOT EXISTS public.app_settings (
  key   text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can modify settings
CREATE POLICY "Admins manage app settings" ON public.app_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Insert default access code
INSERT INTO public.app_settings (key, value)
VALUES ('access_code', '121212')
ON CONFLICT (key) DO NOTHING;

-- Track which users have verified the access code
CREATE TABLE IF NOT EXISTS public.user_access (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  verified_at timestamptz DEFAULT now()
);

ALTER TABLE public.user_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own access" ON public.user_access
  FOR ALL USING (auth.uid() = user_id);

-- Admins can read all user access records
CREATE POLICY "Admins read all user access" ON public.user_access
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Service role bypass
GRANT ALL ON public.app_settings TO service_role;
GRANT ALL ON public.user_access TO service_role;
