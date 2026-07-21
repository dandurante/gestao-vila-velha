-- 1. Criar tabela de indicadores de lojas
CREATE TABLE IF NOT EXISTS public.store_indicators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_name text NOT NULL, -- Ex: 'Jabaquara', 'Spoleto', 'Boali', etc.
  date date NOT NULL DEFAULT CURRENT_DATE,
  fat numeric NOT NULL,
  pedidos integer NOT NULL,
  adt numeric, -- ADT (Min.) - Opcional (apenas Grupo A)
  extremos integer, -- Extremos - Opcional (apenas Grupo A)
  entregas_motoqueiros numeric, -- Entregas/Motoqueiros - Opcional (apenas Grupo A)
  cmv numeric, -- CMV (%) - Opcional (apenas Grupo A)
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(store_name, date)
);

-- 2. Habilitar RLS
ALTER TABLE public.store_indicators ENABLE ROW LEVEL SECURITY;

-- 3. Políticas RLS
DO $$
BEGIN
  -- Permite leitura e escrita para todos os usuários autenticados
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='store_indicators' AND policyname='Allow authenticated users to manage store indicators') THEN
    CREATE POLICY "Allow authenticated users to manage store indicators" ON public.store_indicators
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END
$$;
