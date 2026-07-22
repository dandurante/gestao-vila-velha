-- =============================================================
-- SCRIPT DE INICIALIZAÇÃO COMPLETO - GESTÃO VILA VELHA
-- Projeto Supabase: unltzfldjgykmeppvtqk
-- Execute no SQL Editor: https://supabase.com/dashboard/project/unltzfldjgykmeppvtqk/sql/new
-- =============================================================

-- 1. TABELA DE LANÇAMENTOS FINANCEIROS
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

-- 2. TABELA DE DIÁRIAS / PRESTADORES
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

-- 3. TABELA DE CADASTRO DE PRESTADORES DE SERVIÇO
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

-- 4. TABELA DE E-MAILS PERMITIDOS
CREATE TABLE IF NOT EXISTS public.allowed_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.allowed_emails ENABLE ROW LEVEL SECURITY;

INSERT INTO public.allowed_emails (email)
VALUES 
  ('dandurante@hotmail.com'),
  ('dani.pimentel13@gmail.com')
ON CONFLICT (email) DO NOTHING;

-- 5. TABELA DE LOJAS (Praia da Costa e Itaparica)
CREATE TABLE IF NOT EXISTS public.store_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  address TEXT,
  latitude NUMERIC(10,8),
  longitude NUMERIC(11,8),
  validation_radius NUMERIC(8,2) DEFAULT 200,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.store_locations ENABLE ROW LEVEL SECURITY;

TRUNCATE TABLE public.store_locations CASCADE;

INSERT INTO public.store_locations (name, address, latitude, longitude, validation_radius) VALUES
('Praia da Costa', 'Av. Dr. Olivio Lira, Nº 353 - Praia da Costa, Vila Velha - ES', -20.334, -40.290, 200),
('Itaparica', 'Rua General Osório, nº 127, Edif. A Gazeta, sala 902, Centro, Vitória/ES', -20.345, -40.300, 200);

-- 6. TABELA DE CHECK-INS
CREATE TABLE IF NOT EXISTS public.check_ins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  freelancer_id UUID REFERENCES public.freelancer_registry(id) ON DELETE SET NULL,
  store_id UUID REFERENCES public.store_locations(id) ON DELETE SET NULL,
  unit TEXT NOT NULL,
  checked_in_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  checked_out_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'checked_in',
  latitude NUMERIC(10,8),
  longitude NUMERIC(11,8),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.check_ins ENABLE ROW LEVEL SECURITY;

-- 7. TABELA DE CONTRATOS
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

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

-- 8. TABELA DE RECIBOS ASSINADOS
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

-- 9. TABELA DE INDICADORES DE PERFORMANCE DAS LOJAS
CREATE TABLE IF NOT EXISTS public.store_indicators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_name text NOT NULL,
  date date NOT NULL,
  fat numeric NOT NULL DEFAULT 0,
  pedidos integer NOT NULL DEFAULT 0,
  adt numeric,
  extremos integer,
  entregas_motoqueiros integer,
  cmv numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(store_name, date)
);

ALTER TABLE public.store_indicators ENABLE ROW LEVEL SECURITY;

-- 10. POLÍTICAS RLS PERMISSIVAS PARA OPERAÇÃO DAS TELAS
CREATE POLICY "Public select freelancer_registry" ON public.freelancer_registry FOR SELECT USING (true);
CREATE POLICY "Public insert freelancer_registry" ON public.freelancer_registry FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update freelancer_registry" ON public.freelancer_registry FOR UPDATE USING (true);
CREATE POLICY "Public delete freelancer_registry" ON public.freelancer_registry FOR DELETE USING (true);

CREATE POLICY "Public select freelancers" ON public.freelancers FOR SELECT USING (true);
CREATE POLICY "Public insert freelancers" ON public.freelancers FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update freelancers" ON public.freelancers FOR UPDATE USING (true);
CREATE POLICY "Public delete freelancers" ON public.freelancers FOR DELETE USING (true);

CREATE POLICY "Public select store_locations" ON public.store_locations FOR SELECT USING (true);
CREATE POLICY "Public insert store_locations" ON public.store_locations FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update store_locations" ON public.store_locations FOR UPDATE USING (true);

CREATE POLICY "Public select check_ins" ON public.check_ins FOR SELECT USING (true);
CREATE POLICY "Public insert check_ins" ON public.check_ins FOR INSERT WITH CHECK (true);

CREATE POLICY "Public select contracts" ON public.contracts FOR SELECT USING (true);
CREATE POLICY "Public insert contracts" ON public.contracts FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update contracts" ON public.contracts FOR UPDATE USING (true);

CREATE POLICY "Public select signed_receipts" ON public.signed_receipts FOR SELECT USING (true);
CREATE POLICY "Public insert signed_receipts" ON public.signed_receipts FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update signed_receipts" ON public.signed_receipts FOR UPDATE USING (true);

CREATE POLICY "Public select store_indicators" ON public.store_indicators FOR SELECT USING (true);
CREATE POLICY "Public insert store_indicators" ON public.store_indicators FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update store_indicators" ON public.store_indicators FOR UPDATE USING (true);

-- FIM DO SCRIPT
SELECT 'Banco de dados do Gestão Vila Velha criado e inicializado com sucesso!' AS resultado;
