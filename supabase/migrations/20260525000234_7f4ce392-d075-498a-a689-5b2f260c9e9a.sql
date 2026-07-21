
DROP POLICY IF EXISTS "Authenticated view freelancer_registry" ON public.freelancer_registry;
DROP POLICY IF EXISTS "Authorized insert freelancer_registry" ON public.freelancer_registry;
DROP POLICY IF EXISTS "Authorized update freelancer_registry" ON public.freelancer_registry;
DROP POLICY IF EXISTS "Admins delete freelancer_registry" ON public.freelancer_registry;

CREATE POLICY "Authenticated view freelancer_registry"
  ON public.freelancer_registry FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated insert freelancer_registry"
  ON public.freelancer_registry FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated update freelancer_registry"
  ON public.freelancer_registry FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admins delete freelancer_registry"
  ON public.freelancer_registry FOR DELETE TO authenticated
  USING (is_admin(auth.uid()));
