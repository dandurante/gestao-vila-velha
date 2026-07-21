
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS gps_coordinates JSONB;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS daily_rate NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.freelancers
  ADD COLUMN IF NOT EXISTS payment_amount_paid NUMERIC,
  ADD COLUMN IF NOT EXISTS receipt_token TEXT;

DROP FUNCTION IF EXISTS public.validate_checkin_cpf(TEXT);
CREATE OR REPLACE FUNCTION public.validate_checkin_cpf(p_cpf TEXT)
RETURNS TABLE (id UUID, nome TEXT, role TEXT, active BOOLEAN)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT fr.id, fr.nome, fr.role, fr.active
  FROM public.freelancer_registry fr
  WHERE regexp_replace(fr.cpf, '\D', '', 'g') = regexp_replace(p_cpf, '\D', '', 'g')
  LIMIT 1;
$$;
