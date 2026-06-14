DROP POLICY IF EXISTS "Users manage own sub_profiles" ON public.sub_profiles;
CREATE POLICY "Users manage own sub_profiles"
ON public.sub_profiles
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own red_flag_words" ON public.red_flag_words;
CREATE POLICY "Users manage own red_flag_words"
ON public.red_flag_words
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);