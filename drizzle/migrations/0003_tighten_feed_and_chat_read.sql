DROP POLICY IF EXISTS "feed readable" ON public.feed_posts;
CREATE POLICY "feed readable signed in" ON public.feed_posts FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
REVOKE SELECT ON public.feed_posts FROM anon;
DROP POLICY IF EXISTS "chat read signed in" ON public.community_messages;
CREATE POLICY "chat read signed in" ON public.community_messages FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);