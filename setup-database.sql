-- =============================================================
-- SCRIPT COMPLETO - Execute no SQL Editor do Supabase
-- Projeto: bmivtbtsfjonlczofxii
-- https://supabase.com/dashboard/project/bmivtbtsfjonlczofxii/sql/new
-- =============================================================

-- -------------------------------------------------------
-- MIGRATION 1: cash_entries
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cash_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  unit TEXT NOT NULL,
  cash_in NUMERIC(12,2) NOT NULL DEFAULT 0,
  cash_deposited NUMERIC(12,2) NOT NULL DEFAULT 0,
  expense_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  expense_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cash_entries_date ON public.cash_entries(entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_cash_entries_unit ON public.cash_entries(unit);

ALTER TABLE public.cash_entries ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='update_cash_entries_updated_at') THEN
    CREATE TRIGGER update_cash_entries_updated_at
      BEFORE UPDATE ON public.cash_entries
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- -------------------------------------------------------
-- MIGRATION 2: freelancers
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.freelancers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  unit TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  pix TEXT NOT NULL,
  daily_rate NUMERIC NOT NULL DEFAULT 0,
  deliveries_count INTEGER,
  deliveries_total NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.freelancers ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_freelancers_entry_date ON public.freelancers(entry_date);
CREATE INDEX IF NOT EXISTS idx_freelancers_unit ON public.freelancers(unit);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='update_freelancers_updated_at') THEN
    CREATE TRIGGER update_freelancers_updated_at
      BEFORE UPDATE ON public.freelancers
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- -------------------------------------------------------
-- MIGRATION 3: Extensão HTTP, allowed_emails, freelancer_registry, funções
-- -------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.allowed_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.allowed_emails ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.freelancer_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cpf text NOT NULL DEFAULT '',
  pix text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  telefone text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'Operador',
  endereco text NOT NULL DEFAULT '',
  rg text NOT NULL DEFAULT '',
  estado_civil text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.freelancer_registry ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='update_freelancer_registry_updated_at') THEN
    CREATE TRIGGER update_freelancer_registry_updated_at
      BEFORE UPDATE ON public.freelancer_registry
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.is_email_allowed(check_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.allowed_emails
    WHERE lower(email) = lower(check_email)
  );
$$;

CREATE OR REPLACE FUNCTION public.send_to_zapsign(api_key text, payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  raw_response RECORD;
BEGIN
  SELECT * INTO raw_response FROM extensions.http((
    'POST',
    'https://api.zapsign.com.br/api/v1/docs/',
    ARRAY[extensions.http_header('Authorization', 'Bearer ' || api_key)],
    'application/json',
    payload::text
  )::extensions.http_request);
  RETURN raw_response.content::jsonb;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_zapsign_doc(api_key text, doc_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  raw_response RECORD;
BEGIN
  SELECT * INTO raw_response FROM extensions.http((
    'GET',
    'https://api.zapsign.com.br/api/v1/docs/' || doc_token || '/',
    ARRAY[extensions.http_header('Authorization', 'Bearer ' || api_key)],
    NULL,
    NULL
  )::extensions.http_request);
  RETURN raw_response.content::jsonb;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.send_to_zapsign(text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_zapsign_doc(text, text) TO authenticated;

-- -------------------------------------------------------
-- MIGRATION 5: signed_receipts
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.signed_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zapsign_token text UNIQUE NOT NULL,
  freelancer_name text NOT NULL,
  freelancer_cpf text,
  freelancer_email text,
  role text,
  unit text,
  amount numeric NOT NULL DEFAULT 0,
  reference_period text,
  signed_file_url text,
  status text NOT NULL DEFAULT 'signed',
  signed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.signed_receipts ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_signed_receipts_signed_at ON public.signed_receipts(signed_at DESC);
CREATE INDEX IF NOT EXISTS idx_signed_receipts_freelancer_name ON public.signed_receipts(freelancer_name);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='update_signed_receipts_updated_at') THEN
    CREATE TRIGGER update_signed_receipts_updated_at
      BEFORE UPDATE ON public.signed_receipts
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- -------------------------------------------------------
-- MIGRATION 6: app_role, user_roles, user_store_assignments, funções, contracts
-- -------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'gestor_loja', 'financeiro', 'rh');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin')
$$;

CREATE TABLE IF NOT EXISTS public.user_store_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  unit TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, unit)
);

ALTER TABLE public.user_store_assignments ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.user_has_store_access(_user_id UUID, _unit TEXT)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.is_admin(_user_id)
    OR public.has_role(_user_id, 'financeiro')
    OR public.has_role(_user_id, 'rh')
    OR EXISTS (SELECT 1 FROM public.user_store_assignments WHERE user_id = _user_id AND unit = _unit)
$$;

CREATE TABLE IF NOT EXISTS public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  freelancer_id UUID REFERENCES public.freelancer_registry(id) ON DELETE SET NULL,
  freelancer_name TEXT NOT NULL,
  freelancer_cpf TEXT,
  freelancer_email TEXT,
  unit TEXT,
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('rascunho','pendente','assinado','recusado','vencido','cancelado')),
  zapsign_token TEXT UNIQUE,
  signed_file_url TEXT,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  signed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contracts_status ON public.contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_unit ON public.contracts(unit);
CREATE INDEX IF NOT EXISTS idx_contracts_issued_at ON public.contracts(issued_at);
CREATE INDEX IF NOT EXISTS idx_contracts_freelancer ON public.contracts(freelancer_id);

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='contracts_updated_at') THEN
    CREATE TRIGGER contracts_updated_at
      BEFORE UPDATE ON public.contracts
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- -------------------------------------------------------
-- MIGRATION 7: attendance_employees e attendance_records
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit TEXT NOT NULL,
  name TEXT NOT NULL,
  cpf TEXT,
  regime TEXT NOT NULL DEFAULT 'CLT',
  status TEXT NOT NULL DEFAULT 'OK',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.attendance_employees ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_att_emp_unit ON public.attendance_employees(unit);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='set_updated_at_attendance_employees') THEN
    CREATE TRIGGER set_updated_at_attendance_employees
      BEFORE UPDATE ON public.attendance_employees
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.attendance_employees(id) ON DELETE CASCADE,
  unit TEXT NOT NULL,
  entry_date DATE NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(employee_id, entry_date)
);

ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_att_rec_unit_date ON public.attendance_records(unit, entry_date);
CREATE INDEX IF NOT EXISTS idx_att_rec_employee ON public.attendance_records(employee_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='set_updated_at_attendance_records') THEN
    CREATE TRIGGER set_updated_at_attendance_records
      BEFORE UPDATE ON public.attendance_records
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- -------------------------------------------------------
-- MIGRATION 8: employee_admission_registry
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employee_admission_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cpf text NOT NULL DEFAULT '',
  pix text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  telefone text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'Operador',
  endereco text NOT NULL DEFAULT '',
  rg text NOT NULL DEFAULT '',
  estado_civil text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.employee_admission_registry ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='update_employee_admission_registry_updated_at') THEN
    CREATE TRIGGER update_employee_admission_registry_updated_at
      BEFORE UPDATE ON public.employee_admission_registry
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- -------------------------------------------------------
-- POLICIES FINAIS (todas as tabelas - versão relaxada autenticada)
-- -------------------------------------------------------

-- allowed_emails (admin apenas)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='allowed_emails' AND policyname='Admins view allowed emails') THEN
    CREATE POLICY "Admins view allowed emails" ON public.allowed_emails FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='allowed_emails' AND policyname='Admins insert allowed emails') THEN
    CREATE POLICY "Admins insert allowed emails" ON public.allowed_emails FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='allowed_emails' AND policyname='Admins update allowed emails') THEN
    CREATE POLICY "Admins update allowed emails" ON public.allowed_emails FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='allowed_emails' AND policyname='Admins delete allowed emails') THEN
    CREATE POLICY "Admins delete allowed emails" ON public.allowed_emails FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));
  END IF;
END $$;

-- user_roles
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_roles' AND policyname='Users can view their own roles') THEN
    CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_roles' AND policyname='Only admins can manage roles') THEN
    CREATE POLICY "Only admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
  END IF;
END $$;

-- user_store_assignments
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_store_assignments' AND policyname='Users view own store assignments') THEN
    CREATE POLICY "Users view own store assignments" ON public.user_store_assignments FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_store_assignments' AND policyname='Only admins manage store assignments') THEN
    CREATE POLICY "Only admins manage store assignments" ON public.user_store_assignments FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
  END IF;
END $$;

-- freelancer_registry
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='freelancer_registry' AND policyname='Authenticated view freelancer_registry') THEN
    CREATE POLICY "Authenticated view freelancer_registry" ON public.freelancer_registry FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='freelancer_registry' AND policyname='Authenticated insert freelancer_registry') THEN
    CREATE POLICY "Authenticated insert freelancer_registry" ON public.freelancer_registry FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='freelancer_registry' AND policyname='Authenticated update freelancer_registry') THEN
    CREATE POLICY "Authenticated update freelancer_registry" ON public.freelancer_registry FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='freelancer_registry' AND policyname='Admins delete freelancer_registry') THEN
    CREATE POLICY "Admins delete freelancer_registry" ON public.freelancer_registry FOR DELETE TO authenticated USING (is_admin(auth.uid()));
  END IF;
END $$;

-- freelancers
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='freelancers' AND policyname='Authenticated view freelancers') THEN
    CREATE POLICY "Authenticated view freelancers" ON public.freelancers FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='freelancers' AND policyname='Authenticated insert freelancers') THEN
    CREATE POLICY "Authenticated insert freelancers" ON public.freelancers FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='freelancers' AND policyname='Authenticated update freelancers') THEN
    CREATE POLICY "Authenticated update freelancers" ON public.freelancers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='freelancers' AND policyname='Authenticated delete freelancers') THEN
    CREATE POLICY "Authenticated delete freelancers" ON public.freelancers FOR DELETE TO authenticated USING (true);
  END IF;
END $$;

-- cash_entries
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cash_entries' AND policyname='Authenticated view cash_entries') THEN
    CREATE POLICY "Authenticated view cash_entries" ON public.cash_entries FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cash_entries' AND policyname='Authenticated insert cash_entries') THEN
    CREATE POLICY "Authenticated insert cash_entries" ON public.cash_entries FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cash_entries' AND policyname='Authenticated update cash_entries') THEN
    CREATE POLICY "Authenticated update cash_entries" ON public.cash_entries FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cash_entries' AND policyname='Admins delete cash_entries') THEN
    CREATE POLICY "Admins delete cash_entries" ON public.cash_entries FOR DELETE TO authenticated USING (is_admin(auth.uid()));
  END IF;
END $$;

-- attendance_employees
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='attendance_employees' AND policyname='Authenticated view attendance_employees') THEN
    CREATE POLICY "Authenticated view attendance_employees" ON public.attendance_employees FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='attendance_employees' AND policyname='Authenticated insert attendance_employees') THEN
    CREATE POLICY "Authenticated insert attendance_employees" ON public.attendance_employees FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='attendance_employees' AND policyname='Authenticated update attendance_employees') THEN
    CREATE POLICY "Authenticated update attendance_employees" ON public.attendance_employees FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='attendance_employees' AND policyname='Admins delete attendance_employees') THEN
    CREATE POLICY "Admins delete attendance_employees" ON public.attendance_employees FOR DELETE TO authenticated USING (is_admin(auth.uid()));
  END IF;
END $$;

-- attendance_records
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='attendance_records' AND policyname='Authenticated view attendance_records') THEN
    CREATE POLICY "Authenticated view attendance_records" ON public.attendance_records FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='attendance_records' AND policyname='Authenticated insert attendance_records') THEN
    CREATE POLICY "Authenticated insert attendance_records" ON public.attendance_records FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='attendance_records' AND policyname='Authenticated update attendance_records') THEN
    CREATE POLICY "Authenticated update attendance_records" ON public.attendance_records FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='attendance_records' AND policyname='Admins delete attendance_records') THEN
    CREATE POLICY "Admins delete attendance_records" ON public.attendance_records FOR DELETE TO authenticated USING (is_admin(auth.uid()));
  END IF;
END $$;

-- signed_receipts
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='signed_receipts' AND policyname='Authenticated view signed_receipts') THEN
    CREATE POLICY "Authenticated view signed_receipts" ON public.signed_receipts FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='signed_receipts' AND policyname='Authenticated insert signed_receipts') THEN
    CREATE POLICY "Authenticated insert signed_receipts" ON public.signed_receipts FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='signed_receipts' AND policyname='Authenticated update signed_receipts') THEN
    CREATE POLICY "Authenticated update signed_receipts" ON public.signed_receipts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='signed_receipts' AND policyname='Admins delete signed_receipts') THEN
    CREATE POLICY "Admins delete signed_receipts" ON public.signed_receipts FOR DELETE TO authenticated USING (is_admin(auth.uid()));
  END IF;
END $$;

-- contracts
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='contracts' AND policyname='Authenticated view contracts') THEN
    CREATE POLICY "Authenticated view contracts" ON public.contracts FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='contracts' AND policyname='Authenticated insert contracts') THEN
    CREATE POLICY "Authenticated insert contracts" ON public.contracts FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='contracts' AND policyname='Authenticated update contracts') THEN
    CREATE POLICY "Authenticated update contracts" ON public.contracts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='contracts' AND policyname='Admins delete contracts') THEN
    CREATE POLICY "Admins delete contracts" ON public.contracts FOR DELETE TO authenticated USING (is_admin(auth.uid()));
  END IF;
END $$;

-- employee_admission_registry
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='employee_admission_registry' AND policyname='Anyone can view employee admission registry') THEN
    CREATE POLICY "Anyone can view employee admission registry" ON public.employee_admission_registry FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='employee_admission_registry' AND policyname='Anyone can insert employee admission registry') THEN
    CREATE POLICY "Anyone can insert employee admission registry" ON public.employee_admission_registry FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='employee_admission_registry' AND policyname='Anyone can update employee admission registry') THEN
    CREATE POLICY "Anyone can update employee admission registry" ON public.employee_admission_registry FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='employee_admission_registry' AND policyname='Anyone can delete employee admission registry') THEN
    CREATE POLICY "Anyone can delete employee admission registry" ON public.employee_admission_registry FOR DELETE USING (true);
  END IF;
END $$;

-- -------------------------------------------------------
-- MIGRATION 9: Storage bucket para documentos
-- -------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('employee-documents', 'employee-documents', false)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND policyname='Permitir leitura de arquivos para todos autenticados') THEN
    CREATE POLICY "Permitir leitura de arquivos para todos autenticados"
      ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'employee-documents');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND policyname='Permitir inserção de arquivos para todos autenticados') THEN
    CREATE POLICY "Permitir inserção de arquivos para todos autenticados"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'employee-documents');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND policyname='Permitir exclusão de arquivos para todos autenticados') THEN
    CREATE POLICY "Permitir exclusão de arquivos para todos autenticados"
      ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'employee-documents');
  END IF;
END $$;

-- =============================================================
-- FIM DO SCRIPT
-- =============================================================
SELECT 'Banco de dados configurado com sucesso!' AS resultado;
