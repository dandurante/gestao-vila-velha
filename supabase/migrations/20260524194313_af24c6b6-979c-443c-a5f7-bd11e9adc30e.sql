
-- =========================================================
-- 1. Lock down "Anyone can ..." policies to authenticated users
-- =========================================================

-- allowed_emails: admin-only management (auth gate uses SECURITY DEFINER is_email_allowed)
DROP POLICY IF EXISTS "Anyone can view allowed emails" ON public.allowed_emails;
DROP POLICY IF EXISTS "Anyone can insert allowed emails" ON public.allowed_emails;
DROP POLICY IF EXISTS "Anyone can update allowed emails" ON public.allowed_emails;
DROP POLICY IF EXISTS "Anyone can delete allowed emails" ON public.allowed_emails;

CREATE POLICY "Admins view allowed emails" ON public.allowed_emails
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins insert allowed emails" ON public.allowed_emails
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins update allowed emails" ON public.allowed_emails
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins delete allowed emails" ON public.allowed_emails
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- attendance_employees
DROP POLICY IF EXISTS "Anyone view attendance_employees" ON public.attendance_employees;
DROP POLICY IF EXISTS "Anyone insert attendance_employees" ON public.attendance_employees;
DROP POLICY IF EXISTS "Anyone update attendance_employees" ON public.attendance_employees;
DROP POLICY IF EXISTS "Anyone delete attendance_employees" ON public.attendance_employees;

CREATE POLICY "Authenticated view attendance_employees" ON public.attendance_employees
  FOR SELECT TO authenticated
  USING (public.user_has_store_access(auth.uid(), unit));
CREATE POLICY "Authenticated insert attendance_employees" ON public.attendance_employees
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_store_access(auth.uid(), unit));
CREATE POLICY "Authenticated update attendance_employees" ON public.attendance_employees
  FOR UPDATE TO authenticated
  USING (public.user_has_store_access(auth.uid(), unit))
  WITH CHECK (public.user_has_store_access(auth.uid(), unit));
CREATE POLICY "Admins/RH delete attendance_employees" ON public.attendance_employees
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'rh'::app_role));

-- attendance_records
DROP POLICY IF EXISTS "Anyone view attendance_records" ON public.attendance_records;
DROP POLICY IF EXISTS "Anyone insert attendance_records" ON public.attendance_records;
DROP POLICY IF EXISTS "Anyone update attendance_records" ON public.attendance_records;
DROP POLICY IF EXISTS "Anyone delete attendance_records" ON public.attendance_records;

CREATE POLICY "Authenticated view attendance_records" ON public.attendance_records
  FOR SELECT TO authenticated
  USING (public.user_has_store_access(auth.uid(), unit));
CREATE POLICY "Authenticated insert attendance_records" ON public.attendance_records
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_store_access(auth.uid(), unit));
CREATE POLICY "Authenticated update attendance_records" ON public.attendance_records
  FOR UPDATE TO authenticated
  USING (public.user_has_store_access(auth.uid(), unit))
  WITH CHECK (public.user_has_store_access(auth.uid(), unit));
CREATE POLICY "Admins/RH delete attendance_records" ON public.attendance_records
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'rh'::app_role));

-- cash_entries
DROP POLICY IF EXISTS "Anyone can view cash entries" ON public.cash_entries;
DROP POLICY IF EXISTS "Anyone can insert cash entries" ON public.cash_entries;
DROP POLICY IF EXISTS "Anyone can update cash entries" ON public.cash_entries;
DROP POLICY IF EXISTS "Anyone can delete cash entries" ON public.cash_entries;

CREATE POLICY "Authenticated view cash_entries" ON public.cash_entries
  FOR SELECT TO authenticated
  USING (public.user_has_store_access(auth.uid(), unit));
CREATE POLICY "Authenticated insert cash_entries" ON public.cash_entries
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_store_access(auth.uid(), unit));
CREATE POLICY "Authenticated update cash_entries" ON public.cash_entries
  FOR UPDATE TO authenticated
  USING (public.user_has_store_access(auth.uid(), unit))
  WITH CHECK (public.user_has_store_access(auth.uid(), unit));
CREATE POLICY "Admins/Financeiro delete cash_entries" ON public.cash_entries
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'financeiro'::app_role));

-- freelancer_registry
DROP POLICY IF EXISTS "Anyone can view freelancer registry" ON public.freelancer_registry;
DROP POLICY IF EXISTS "Anyone can insert freelancer registry" ON public.freelancer_registry;
DROP POLICY IF EXISTS "Only admin can update freelancer registry" ON public.freelancer_registry;
DROP POLICY IF EXISTS "Only admin can delete freelancer registry" ON public.freelancer_registry;

CREATE POLICY "Authenticated view freelancer_registry" ON public.freelancer_registry
  FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.has_role(auth.uid(), 'rh'::app_role)
    OR public.has_role(auth.uid(), 'financeiro'::app_role)
  );
CREATE POLICY "Authorized insert freelancer_registry" ON public.freelancer_registry
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin(auth.uid())
    OR public.has_role(auth.uid(), 'rh'::app_role)
  );
CREATE POLICY "Authorized update freelancer_registry" ON public.freelancer_registry
  FOR UPDATE TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.has_role(auth.uid(), 'rh'::app_role)
  )
  WITH CHECK (
    public.is_admin(auth.uid())
    OR public.has_role(auth.uid(), 'rh'::app_role)
  );
CREATE POLICY "Admins delete freelancer_registry" ON public.freelancer_registry
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- freelancers
DROP POLICY IF EXISTS "Anyone can view freelancers" ON public.freelancers;
DROP POLICY IF EXISTS "Anyone can insert freelancers" ON public.freelancers;
DROP POLICY IF EXISTS "Anyone can update freelancers" ON public.freelancers;
DROP POLICY IF EXISTS "Only admin can delete freelancers" ON public.freelancers;

CREATE POLICY "Authenticated view freelancers" ON public.freelancers
  FOR SELECT TO authenticated
  USING (public.user_has_store_access(auth.uid(), unit));
CREATE POLICY "Authenticated insert freelancers" ON public.freelancers
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_store_access(auth.uid(), unit));
CREATE POLICY "Authenticated update freelancers" ON public.freelancers
  FOR UPDATE TO authenticated
  USING (public.user_has_store_access(auth.uid(), unit))
  WITH CHECK (public.user_has_store_access(auth.uid(), unit));
CREATE POLICY "Admins delete freelancers" ON public.freelancers
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- signed_receipts
DROP POLICY IF EXISTS "Anyone can view signed receipts" ON public.signed_receipts;
DROP POLICY IF EXISTS "Anyone can insert signed receipts" ON public.signed_receipts;
DROP POLICY IF EXISTS "Anyone can update signed receipts" ON public.signed_receipts;
DROP POLICY IF EXISTS "Anyone can delete signed receipts" ON public.signed_receipts;

CREATE POLICY "Authenticated view signed_receipts" ON public.signed_receipts
  FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.has_role(auth.uid(), 'financeiro'::app_role)
    OR public.has_role(auth.uid(), 'rh'::app_role)
    OR (unit IS NOT NULL AND public.user_has_store_access(auth.uid(), unit))
  );
CREATE POLICY "Authorized insert signed_receipts" ON public.signed_receipts
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin(auth.uid())
    OR public.has_role(auth.uid(), 'rh'::app_role)
    OR (unit IS NOT NULL AND public.user_has_store_access(auth.uid(), unit))
  );
CREATE POLICY "Authorized update signed_receipts" ON public.signed_receipts
  FOR UPDATE TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.has_role(auth.uid(), 'rh'::app_role)
    OR (unit IS NOT NULL AND public.user_has_store_access(auth.uid(), unit))
  )
  WITH CHECK (
    public.is_admin(auth.uid())
    OR public.has_role(auth.uid(), 'rh'::app_role)
    OR (unit IS NOT NULL AND public.user_has_store_access(auth.uid(), unit))
  );
CREATE POLICY "Admins delete signed_receipts" ON public.signed_receipts
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- =========================================================
-- 2. Remove privilege escalation on contracts (NOT EXISTS user_roles)
-- =========================================================
DROP POLICY IF EXISTS "Authenticated users can view contracts" ON public.contracts;
DROP POLICY IF EXISTS "Authenticated users can insert contracts" ON public.contracts;
DROP POLICY IF EXISTS "Authenticated users can update contracts" ON public.contracts;

CREATE POLICY "Authorized view contracts" ON public.contracts
  FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.has_role(auth.uid(), 'financeiro'::app_role)
    OR public.has_role(auth.uid(), 'rh'::app_role)
    OR (unit IS NOT NULL AND public.user_has_store_access(auth.uid(), unit))
  );
CREATE POLICY "Authorized insert contracts" ON public.contracts
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin(auth.uid())
    OR public.has_role(auth.uid(), 'rh'::app_role)
    OR (unit IS NOT NULL AND public.user_has_store_access(auth.uid(), unit))
  );
CREATE POLICY "Authorized update contracts" ON public.contracts
  FOR UPDATE TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.has_role(auth.uid(), 'rh'::app_role)
    OR (unit IS NOT NULL AND public.user_has_store_access(auth.uid(), unit))
  )
  WITH CHECK (
    public.is_admin(auth.uid())
    OR public.has_role(auth.uid(), 'rh'::app_role)
    OR (unit IS NOT NULL AND public.user_has_store_access(auth.uid(), unit))
  );

-- =========================================================
-- 3. Pin search_path on functions missing it
-- =========================================================
ALTER FUNCTION public.is_email_allowed(text) SET search_path = public;
ALTER FUNCTION public.get_zapsign_doc(text, text) SET search_path = public;
ALTER FUNCTION public.send_to_zapsign(text, jsonb) SET search_path = public;

-- =========================================================
-- 4. Revoke EXECUTE on sensitive SECURITY DEFINER functions
--    (these accept an API key argument; not safe to expose via PostgREST)
-- =========================================================
REVOKE ALL ON FUNCTION public.get_zapsign_doc(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.send_to_zapsign(text, jsonb) FROM PUBLIC, anon, authenticated;
