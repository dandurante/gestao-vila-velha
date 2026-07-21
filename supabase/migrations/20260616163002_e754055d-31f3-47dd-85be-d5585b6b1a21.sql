
-- 1. freelancer_registry: add active
ALTER TABLE public.freelancer_registry ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;

-- 2. freelancers: add workflow columns
ALTER TABLE public.freelancers
  ADD COLUMN IF NOT EXISTS checkin_id UUID,
  ADD COLUMN IF NOT EXISTS validation_status TEXT NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS validated_by TEXT,
  ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS approved_by TEXT,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS payment_date DATE,
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS payment_voucher_url TEXT,
  ADD COLUMN IF NOT EXISTS paid_by TEXT,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- 3. store_locations
CREATE TABLE IF NOT EXISTS public.store_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  address TEXT,
  latitude DOUBLE PRECISION NOT NULL DEFAULT 0,
  longitude DOUBLE PRECISION NOT NULL DEFAULT 0,
  validation_radius INTEGER NOT NULL DEFAULT 200,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_locations TO authenticated;
GRANT ALL ON public.store_locations TO service_role;
ALTER TABLE public.store_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view_store_locations" ON public.store_locations FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_manage_store_locations" ON public.store_locations FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER update_store_locations_updated_at BEFORE UPDATE ON public.store_locations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. check_ins
CREATE TABLE IF NOT EXISTS public.check_ins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  freelancer_id UUID REFERENCES public.freelancer_registry(id) ON DELETE SET NULL,
  unit TEXT NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  accuracy DOUBLE PRECISION,
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'Check-in Validado',
  device_info TEXT,
  ip_address TEXT,
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.check_ins TO authenticated;
GRANT ALL ON public.check_ins TO service_role;
ALTER TABLE public.check_ins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view_check_ins" ON public.check_ins FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_check_ins" ON public.check_ins FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_check_ins" ON public.check_ins FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_check_ins_admin" ON public.check_ins FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));
CREATE TRIGGER update_check_ins_updated_at BEFORE UPDATE ON public.check_ins FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. checkin_restrictions
CREATE TABLE IF NOT EXISTS public.checkin_restrictions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_name TEXT NOT NULL,
  role TEXT NOT NULL,
  is_disabled BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_name, role)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checkin_restrictions TO authenticated;
GRANT ALL ON public.checkin_restrictions TO service_role;
ALTER TABLE public.checkin_restrictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view_checkin_restrictions" ON public.checkin_restrictions FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_manage_checkin_restrictions" ON public.checkin_restrictions FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER update_checkin_restrictions_updated_at BEFORE UPDATE ON public.checkin_restrictions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. audit_logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  user_email TEXT,
  user_profile TEXT,
  action TEXT NOT NULL,
  freelancer_id UUID,
  freelancer_name TEXT,
  unit TEXT,
  old_status TEXT,
  new_status TEXT,
  device_info TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view_audit_logs_admin" ON public.audit_logs FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "insert_audit_logs" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);

-- 7. validate_checkin_cpf RPC
CREATE OR REPLACE FUNCTION public.validate_checkin_cpf(_cpf TEXT)
RETURNS TABLE (id UUID, nome TEXT, role TEXT, active BOOLEAN)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT fr.id, fr.nome, fr.role, fr.active
  FROM public.freelancer_registry fr
  WHERE regexp_replace(fr.cpf, '\D', '', 'g') = regexp_replace(_cpf, '\D', '', 'g')
  LIMIT 1;
$$;
