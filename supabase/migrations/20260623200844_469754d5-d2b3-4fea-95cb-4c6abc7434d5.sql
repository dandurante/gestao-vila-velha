CREATE TABLE IF NOT EXISTS public.store_indicators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_name text NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  fat numeric NOT NULL,
  pedidos integer NOT NULL,
  adt numeric,
  extremos integer,
  entregas_motoqueiros numeric,
  cmv numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(store_name, date)
);

GRANT SELECT ON public.store_indicators TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_indicators TO authenticated;
GRANT ALL ON public.store_indicators TO service_role;

ALTER TABLE public.store_indicators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura anonima" ON public.store_indicators FOR SELECT TO anon USING (true);

CREATE POLICY "Permitir edicao autenticada" ON public.store_indicators FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_store_indicators_updated_at
BEFORE UPDATE ON public.store_indicators
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();