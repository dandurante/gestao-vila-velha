GRANT INSERT ON public.check_ins TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.check_ins TO authenticated;
GRANT ALL ON public.check_ins TO service_role;

DROP POLICY IF EXISTS anon_insert_check_ins ON public.check_ins;
DROP POLICY IF EXISTS checkin_insert_anon_auth ON public.check_ins;
DROP POLICY IF EXISTS insert_check_ins ON public.check_ins;

CREATE POLICY "Public portal can create check-ins"
ON public.check_ins
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

NOTIFY pgrst, 'reload schema';