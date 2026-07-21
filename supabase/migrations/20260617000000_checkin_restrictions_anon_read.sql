-- Garante que a página pública de check-in (executada como `anon`) consiga
-- LER a tabela checkin_restrictions. A policy de leitura pública foi criada
-- originalmente em 20260616000000_checkin_toggle.sql, mas esse arquivo tem
-- timestamp anterior a migrations já aplicadas (20260616163002 / 163045),
-- então pode ter sido ignorado pelo runner — deixando o `anon` sem acesso e
-- fazendo o bloqueio de check-in nunca ter efeito na tela do prestador.
--
-- Idempotente: só cria a policy se ainda não existir nenhuma de leitura para anon.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'checkin_restrictions'
      AND policyname = 'anon_read_checkin_restrictions'
  ) THEN
    CREATE POLICY "anon_read_checkin_restrictions"
      ON public.checkin_restrictions
      FOR SELECT
      TO anon, authenticated
      USING (true);
  END IF;
END
$$;

GRANT SELECT ON public.checkin_restrictions TO anon;
