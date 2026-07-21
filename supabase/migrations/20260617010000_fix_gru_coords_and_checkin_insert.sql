-- (A) Coordenada autoritativa da loja GRU.
-- A migration 20260612000000_operational_control.sql re-semeia store_locations
-- com ON CONFLICT DO UPDATE das coordenadas, então a cada deploy ela sobrescreve
-- ajustes manuais. Esta migration tem timestamp posterior e roda por último,
-- fixando a coordenada correta (23°25'36.2"S 46°28'56.0"W).
UPDATE public.store_locations
SET latitude = -23.426722,
    longitude = -46.482222
WHERE name = 'GRU';

-- (B) INSERT em check_ins para anon E authenticated.
-- A tela /checkin é pública, mas quando o usuário testa logado a requisição
-- vai como `authenticated`; a policy só-anon não cobre esse caso.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'check_ins' AND policyname = 'checkin_insert_anon_auth'
  ) THEN
    CREATE POLICY "checkin_insert_anon_auth" ON public.check_ins
      FOR INSERT TO anon, authenticated WITH CHECK (true);
  END IF;
END
$$;
GRANT INSERT ON public.check_ins TO anon, authenticated;

-- (C) INSERT em audit_logs para anon E authenticated (gravado logo após o check-in).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'audit_logs' AND policyname = 'audit_insert_anon_auth'
  ) THEN
    CREATE POLICY "audit_insert_anon_auth" ON public.audit_logs
      FOR INSERT TO anon, authenticated WITH CHECK (true);
  END IF;
END
$$;
GRANT INSERT ON public.audit_logs TO anon, authenticated;
