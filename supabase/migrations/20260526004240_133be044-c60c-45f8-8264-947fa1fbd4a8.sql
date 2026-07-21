
-- freelancers
DROP POLICY IF EXISTS "Authenticated view freelancers" ON public.freelancers;
DROP POLICY IF EXISTS "Authenticated insert freelancers" ON public.freelancers;
DROP POLICY IF EXISTS "Authenticated update freelancers" ON public.freelancers;
DROP POLICY IF EXISTS "Admins delete freelancers" ON public.freelancers;
CREATE POLICY "Authenticated view freelancers" ON public.freelancers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert freelancers" ON public.freelancers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update freelancers" ON public.freelancers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admins delete freelancers" ON public.freelancers FOR DELETE TO authenticated USING (is_admin(auth.uid()));

-- cash_entries
DROP POLICY IF EXISTS "Authenticated view cash_entries" ON public.cash_entries;
DROP POLICY IF EXISTS "Authenticated insert cash_entries" ON public.cash_entries;
DROP POLICY IF EXISTS "Authenticated update cash_entries" ON public.cash_entries;
DROP POLICY IF EXISTS "Admins/Financeiro delete cash_entries" ON public.cash_entries;
CREATE POLICY "Authenticated view cash_entries" ON public.cash_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert cash_entries" ON public.cash_entries FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update cash_entries" ON public.cash_entries FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admins delete cash_entries" ON public.cash_entries FOR DELETE TO authenticated USING (is_admin(auth.uid()));

-- attendance_employees
DROP POLICY IF EXISTS "Authenticated view attendance_employees" ON public.attendance_employees;
DROP POLICY IF EXISTS "Authenticated insert attendance_employees" ON public.attendance_employees;
DROP POLICY IF EXISTS "Authenticated update attendance_employees" ON public.attendance_employees;
DROP POLICY IF EXISTS "Admins/RH delete attendance_employees" ON public.attendance_employees;
CREATE POLICY "Authenticated view attendance_employees" ON public.attendance_employees FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert attendance_employees" ON public.attendance_employees FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update attendance_employees" ON public.attendance_employees FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admins delete attendance_employees" ON public.attendance_employees FOR DELETE TO authenticated USING (is_admin(auth.uid()));

-- attendance_records
DROP POLICY IF EXISTS "Authenticated view attendance_records" ON public.attendance_records;
DROP POLICY IF EXISTS "Authenticated insert attendance_records" ON public.attendance_records;
DROP POLICY IF EXISTS "Authenticated update attendance_records" ON public.attendance_records;
DROP POLICY IF EXISTS "Admins/RH delete attendance_records" ON public.attendance_records;
CREATE POLICY "Authenticated view attendance_records" ON public.attendance_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert attendance_records" ON public.attendance_records FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update attendance_records" ON public.attendance_records FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admins delete attendance_records" ON public.attendance_records FOR DELETE TO authenticated USING (is_admin(auth.uid()));

-- signed_receipts
DROP POLICY IF EXISTS "Authenticated view signed_receipts" ON public.signed_receipts;
DROP POLICY IF EXISTS "Authorized insert signed_receipts" ON public.signed_receipts;
DROP POLICY IF EXISTS "Authorized update signed_receipts" ON public.signed_receipts;
DROP POLICY IF EXISTS "Admins delete signed_receipts" ON public.signed_receipts;
CREATE POLICY "Authenticated view signed_receipts" ON public.signed_receipts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert signed_receipts" ON public.signed_receipts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update signed_receipts" ON public.signed_receipts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admins delete signed_receipts" ON public.signed_receipts FOR DELETE TO authenticated USING (is_admin(auth.uid()));

-- contracts
DROP POLICY IF EXISTS "Authorized view contracts" ON public.contracts;
DROP POLICY IF EXISTS "Authorized insert contracts" ON public.contracts;
DROP POLICY IF EXISTS "Authorized update contracts" ON public.contracts;
DROP POLICY IF EXISTS "Only admins can delete contracts" ON public.contracts;
CREATE POLICY "Authenticated view contracts" ON public.contracts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert contracts" ON public.contracts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update contracts" ON public.contracts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admins delete contracts" ON public.contracts FOR DELETE TO authenticated USING (is_admin(auth.uid()));
