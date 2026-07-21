-- 1. Criar tabela para armazenar as restrições/bloqueios de check-in
CREATE TABLE IF NOT EXISTS public.checkin_restrictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_name text NOT NULL, -- Ex: 'Jabaquara', 'Spoleto', etc.
  role text NOT NULL,       -- Ex: 'Operador', 'Entregador'
  is_disabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text,
  UNIQUE(store_name, role)
);

-- 2. Habilitar RLS
ALTER TABLE public.checkin_restrictions ENABLE ROW LEVEL SECURITY;

-- 3. Políticas RLS
DO $$
BEGIN
  -- Permite leitura pública (qualquer pessoa que acesse a tela de check-in pode consultar as restrições)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='checkin_restrictions' AND policyname='Allow public read access to checkin_restrictions') THEN
    CREATE POLICY "Allow public read access to checkin_restrictions" ON public.checkin_restrictions
      FOR SELECT TO anon, authenticated USING (true);
  END IF;

  -- Apenas administradores podem inserir/atualizar/excluir restrições
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='checkin_restrictions' AND policyname='Allow admins to manage checkin_restrictions') THEN
    CREATE POLICY "Allow admins to manage checkin_restrictions" ON public.checkin_restrictions
      FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
  END IF;
END
$$;
