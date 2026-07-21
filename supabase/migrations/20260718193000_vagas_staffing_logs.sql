-- Migration: Controle de Mão de Obra (Gestão de Equipe)
-- Date: 2026-07-18 19:30:00 UTC

CREATE TABLE IF NOT EXISTS public.vagas_staffing_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit text NOT NULL,
  log_date date NOT NULL,
  total_staff integer NOT NULL,
  freelancers_count integer NOT NULL,
  submitted_by text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT unique_unit_date UNIQUE (unit, log_date)
);

-- Habilitar RLS
ALTER TABLE public.vagas_staffing_logs ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para vagas_staffing_logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'vagas_staffing_logs' AND policyname = 'Allow read on staffing logs'
  ) THEN
    CREATE POLICY "Allow read on staffing logs" ON public.vagas_staffing_logs FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'vagas_staffing_logs' AND policyname = 'Allow insert on staffing logs'
  ) THEN
    CREATE POLICY "Allow insert on staffing logs" ON public.vagas_staffing_logs FOR INSERT WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'vagas_staffing_logs' AND policyname = 'Allow update on staffing logs'
  ) THEN
    CREATE POLICY "Allow update on staffing logs" ON public.vagas_staffing_logs FOR UPDATE USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'vagas_staffing_logs' AND policyname = 'Allow delete on staffing logs'
  ) THEN
    CREATE POLICY "Allow delete on staffing logs" ON public.vagas_staffing_logs FOR DELETE USING (true);
  END IF;
END $$;
