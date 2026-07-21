-- Garante TODAS as permissões `anon` necessárias para o fluxo público de
-- check-in (/checkin roda sem login). As policies `TO anon` vieram de
-- 20260612000000_operational_control.sql, mas no banco ao vivo só existem as
-- versões `authenticated` (recriadas em 20260616163002), então o anon falha em
-- cada etapa: ler lojas, inserir check-in, subir foto e gravar log.
--
-- store_locations (SELECT) e checkin_restrictions (SELECT) já são tratados nas
-- migrations 20260617000002 e 20260617000000. Aqui cobrimos o restante.

-- 1) check_ins: INSERT por anon
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'check_ins' AND policyname = 'anon_insert_check_ins'
  ) THEN
    CREATE POLICY "anon_insert_check_ins" ON public.check_ins
      FOR INSERT TO anon WITH CHECK (true);
  END IF;
END
$$;
GRANT INSERT ON public.check_ins TO anon;

-- 2) audit_logs: INSERT por anon
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'audit_logs' AND policyname = 'anon_insert_audit_logs'
  ) THEN
    CREATE POLICY "anon_insert_audit_logs" ON public.audit_logs
      FOR INSERT TO anon WITH CHECK (true);
  END IF;
END
$$;
GRANT INSERT ON public.audit_logs TO anon;

-- 3) bucket de fotos do check-in (público) + policies de storage para anon
INSERT INTO storage.buckets (id, name, public)
VALUES ('checkin-photos', 'checkin-photos', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'anon_upload_checkin_photos'
  ) THEN
    CREATE POLICY "anon_upload_checkin_photos" ON storage.objects
      FOR INSERT TO anon WITH CHECK (bucket_id = 'checkin-photos');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'anon_read_checkin_photos'
  ) THEN
    CREATE POLICY "anon_read_checkin_photos" ON storage.objects
      FOR SELECT TO anon USING (bucket_id = 'checkin-photos');
  END IF;
END
$$;
