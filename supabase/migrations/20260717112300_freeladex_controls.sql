-- Migration: Evolução do Controle de Contratos, Recibos e Auditoria
-- Date: 2026-07-17 11:23:00 UTC

-- 1. Ajustes na tabela audit_logs
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS freelancer_cpf text;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS reason text;

-- 2. Tabela de parametrização da janela de emissão de recibos
CREATE TABLE IF NOT EXISTS public.vagas_receipt_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  freelancer_day integer NOT NULL DEFAULT 0, -- 0 = Domingo
  motoboy_day integer NOT NULL DEFAULT 3,     -- 3 = Quarta-feira
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.vagas_receipt_settings ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para vagas_receipt_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'vagas_receipt_settings' AND policyname = 'Allow anon and authenticated read on receipt settings'
  ) THEN
    CREATE POLICY "Allow anon and authenticated read on receipt settings" ON public.vagas_receipt_settings FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'vagas_receipt_settings' AND policyname = 'Allow authenticated update on receipt settings'
  ) THEN
    CREATE POLICY "Allow authenticated update on receipt settings" ON public.vagas_receipt_settings FOR UPDATE USING (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'vagas_receipt_settings' AND policyname = 'Allow authenticated insert on receipt settings'
  ) THEN
    CREATE POLICY "Allow authenticated insert on receipt settings" ON public.vagas_receipt_settings FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  END IF;
END $$;

-- Inserir registro semente inicial se a tabela estiver vazia
INSERT INTO public.vagas_receipt_settings (freelancer_day, motoboy_day)
SELECT 0, 3
WHERE NOT EXISTS (SELECT 1 FROM public.vagas_receipt_settings);

-- 3. Regra de Transição: Cancelamento lógico dos recibos pendentes antigos
UPDATE public.signed_receipts
SET status = 'Desconsiderado',
    updated_at = timezone('utc'::text, now())
WHERE status = 'pending' OR status = 'pendente';

-- Registrar ação de transição na auditoria
INSERT INTO public.audit_logs (action, old_status, new_status, reason, device_info, created_at)
VALUES (
  'Cancelamento lógico em massa',
  'pendente',
  'Desconsiderado',
  'Regra de transição da melhoria de controle de recibos',
  'Migração SQL do Sistema',
  timezone('utc'::text, now())
);
