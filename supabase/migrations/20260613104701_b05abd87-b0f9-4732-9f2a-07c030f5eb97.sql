ALTER TABLE public.sub_profiles
  ADD COLUMN IF NOT EXISTS niche text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS whatsapp text;