DROP POLICY IF EXISTS admin_manage_checkin_restrictions ON public.checkin_restrictions;
CREATE POLICY authenticated_manage_checkin_restrictions ON public.checkin_restrictions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);