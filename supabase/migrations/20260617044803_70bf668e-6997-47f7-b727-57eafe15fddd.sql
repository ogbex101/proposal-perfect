-- 1. Backfill admin role for the owner email (idempotent)
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::public.app_role
FROM auth.users u
WHERE u.email = 'ogbeifundaniel0@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- 2. Profile image gallery
CREATE TABLE public.profile_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_images TO authenticated;
GRANT ALL ON public.profile_images TO service_role;
ALTER TABLE public.profile_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own profile images"
  ON public.profile_images FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE INDEX profile_images_user_id_idx ON public.profile_images(user_id, created_at DESC);

-- 3. Proposal snippets / templates
CREATE TABLE public.proposal_snippets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposal_snippets TO authenticated;
GRANT ALL ON public.proposal_snippets TO service_role;
ALTER TABLE public.proposal_snippets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own snippets"
  ON public.proposal_snippets FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE INDEX proposal_snippets_user_idx ON public.proposal_snippets(user_id, category, created_at DESC);
CREATE TRIGGER trg_proposal_snippets_updated
  BEFORE UPDATE ON public.proposal_snippets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Proposal drafts (one per user, latest in-progress proposal)
CREATE TABLE public.proposal_drafts (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposal_drafts TO authenticated;
GRANT ALL ON public.proposal_drafts TO service_role;
ALTER TABLE public.proposal_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own draft"
  ON public.proposal_drafts FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_proposal_drafts_updated
  BEFORE UPDATE ON public.proposal_drafts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();