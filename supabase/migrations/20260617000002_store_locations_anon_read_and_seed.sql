-- Garante que a tela pública de check-in (executada como `anon`) consiga LISTAR
-- as lojas, e que existam lojas para selecionar.
--
-- Mesmo padrão do problema de checkin_restrictions: a policy de leitura anon e o
-- seed vieram de 20260612000000_operational_control.sql, que pode não ter sido
-- aplicado integralmente — deixando a tabela vazia ou sem acesso anon, e o
-- dropdown de "Unidade Comercial" sem nenhuma loja.

-- 1) Policy de leitura anon (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'store_locations'
      AND policyname = 'anon_read_store_locations'
  ) THEN
    CREATE POLICY "anon_read_store_locations" ON public.store_locations
      FOR SELECT TO anon, authenticated USING (true);
  END IF;
END
$$;

GRANT SELECT ON public.store_locations TO anon;

-- 2) Seed das lojas padrão — não sobrescreve coordenadas já ajustadas pelo admin
INSERT INTO public.store_locations (name, address, latitude, longitude, validation_radius) VALUES
  ('Jabaquara', 'Avenida Doutor Luis Rocha Miranda, 164 - CEP: 04344-010', -23.6455, -46.6418, 150),
  ('Spoleto', 'Avenida Doutor Luis Rocha Miranda, 164 - CEP: 04344-010', -23.6455, -46.6418, 150),
  ('Campo Belo', 'Rua Dr Jesuino Maciel, 1186 - CEP: 04615-004', -23.6268, -46.6667, 150),
  ('V. Clementino', 'Rua Loefgren, 1448 - CEP: 04040-001', -23.5996, -46.6414, 150),
  ('V. GOPOUVA', 'Rua Cônego Valadao, 939 - CEP: 07040-000', -23.4682, -46.5263, 150),
  ('P. MANDAQUI', 'Avenida Santa Inês, 1048 - CEP: 02415-001', -23.4862, -46.6341, 150),
  ('Aclimação', 'Avenida da Aclimação, 101 - CEP: 01531-001', -23.5714, -46.6288, 150),
  ('Pinheiros', 'Rua Inácio Pereira da Rocha, 511 - CEP: 05432-011', -23.5583, -46.6881, 150),
  ('GRU', 'Rodovia Hélio Smith S/N - CEP: 07190-100', -23.4356, -46.4731, 150),
  ('J. Camburi', 'Rua Gelu Vervloet Dos Santos, Edifício Norte Sul Tower, Loja 01 - CEP: 29090-100', -20.2589, -40.2709, 150),
  ('P. Canto', 'Avenida Rio Branco, 1777, loja 04 E 05 - CEP: 29055-642', -20.3019, -40.2941, 150),
  ('Serra', 'Avenida Primeira Avenida, 60 - CEP: 29165-155', -20.1472, -40.2721, 150),
  ('Boali', 'Av. Dr. Olivio Lira, Nº 353 - CEP: 29101-950', -20.3298, -40.2925, 150)
ON CONFLICT (name) DO NOTHING;
