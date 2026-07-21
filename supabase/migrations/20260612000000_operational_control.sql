-- 1. Novos Perfis no Enum app_role (Adicionando diretor e coordenador se não existirem)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'diretor';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'coordenador';

-- 2. Tabela de Configuração Geográfica das Lojas
CREATE TABLE IF NOT EXISTS public.store_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  address text,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  validation_radius numeric NOT NULL DEFAULT 150,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Habilitar RLS para store_locations
ALTER TABLE public.store_locations ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para store_locations
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='store_locations' AND policyname='Authenticated users can manage store locations') THEN
    CREATE POLICY "Authenticated users can manage store locations" ON public.store_locations FOR ALL TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='store_locations' AND policyname='Public read access to store locations for check-in') THEN
    CREATE POLICY "Public read access to store locations for check-in" ON public.store_locations FOR SELECT TO anon USING (true);
  END IF;
END
$$;

-- Preencher lojas padrão com coordenadas fictícias iniciais (centro das cidades correspondentes)
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
ON CONFLICT (name) DO UPDATE SET 
  address = EXCLUDED.address,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude;

-- 3. Tabela de Check-ins
CREATE TABLE IF NOT EXISTS public.check_ins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  freelancer_id uuid REFERENCES public.freelancer_registry(id) ON DELETE CASCADE,
  unit text NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  accuracy double precision,
  image_url text NOT NULL,
  status text NOT NULL, -- 'Check-in Validado', 'Check-in Rejeitado'
  checked_in_at timestamptz NOT NULL DEFAULT now(),
  device_info text,
  ip_address text
);

-- Habilitar RLS para check_ins
ALTER TABLE public.check_ins ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para check_ins
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='check_ins' AND policyname='Authenticated users can view/manage check-ins') THEN
    CREATE POLICY "Authenticated users can view/manage check-ins" ON public.check_ins FOR ALL TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='check_ins' AND policyname='Allow public inserts for check-ins') THEN
    CREATE POLICY "Allow public inserts for check-ins" ON public.check_ins FOR INSERT TO anon WITH CHECK (true);
  END IF;
END
$$;

-- 4. Função Segura de Validação de CPF para o Check-in Público
CREATE OR REPLACE FUNCTION public.validate_checkin_cpf(p_cpf text)
RETURNS jsonb
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
  f_rec record;
  contract_rec record;
  pending_receipt_count int;
BEGIN
  -- Limpar caracteres do CPF
  p_cpf := regexp_replace(p_cpf, '\D', '', 'g');

  -- Buscar prestador cadastrado no cadastro de prestadores (freelancers)
  SELECT * INTO f_rec FROM public.freelancer_registry 
  WHERE regexp_replace(cpf, '\D', '', 'g') = p_cpf LIMIT 1;

  IF f_rec.id IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'Prestador não cadastrado.');
  END IF;

  -- Verificar se está ativo
  IF NOT COALESCE(f_rec.active, true) THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'Prestador inativo.');
  END IF;

  -- Verificar contrato assinado e vigente
  SELECT * INTO contract_rec FROM public.contracts
  WHERE regexp_replace(freelancer_cpf, '\D', '', 'g') = p_cpf
    AND status = 'assinado'
    AND (expires_at IS NULL OR expires_at >= now())
  ORDER BY signed_at DESC LIMIT 1;

  IF contract_rec.id IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'Contrato pendente de assinatura ou fora da vigência.');
  END IF;

  -- Verificar recibo pendente de assinatura há mais de 3 dias
  SELECT COUNT(*)::int INTO pending_receipt_count FROM public.signed_receipts
  WHERE regexp_replace(freelancer_cpf, '\D', '', 'g') = p_cpf
    AND status IN ('pending', 'sent')
    AND created_at < (now() - interval '3 days');

  IF pending_receipt_count > 0 THEN
    RETURN jsonb_build_object(
      'valid', false, 
      'reason', 'Existe recibo pendente de assinatura há mais de 3 dias. Regularize a pendência antes de realizar novo check-in.'
    );
  END IF;

  -- Retornar sucesso com os dados mínimos
  RETURN jsonb_build_object(
    'valid', true,
    'freelancer_id', f_rec.id,
    'nome', f_rec.nome,
    'role', f_rec.role
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_checkin_cpf(text) TO anon, authenticated;

-- 5. Alterar tabelas existentes (Colunas de validação e controle operacional)
ALTER TABLE public.freelancer_registry ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

ALTER TABLE public.freelancers 
  ADD COLUMN IF NOT EXISTS checkin_id uuid REFERENCES public.check_ins(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS validation_status text NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS validation_notes text,
  ADD COLUMN IF NOT EXISTS validated_by text,
  ADD COLUMN IF NOT EXISTS validated_at timestamptz,
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS approved_by text,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS payment_date date,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS payment_amount_paid numeric,
  ADD COLUMN IF NOT EXISTS payment_voucher_url text,
  ADD COLUMN IF NOT EXISTS receipt_token text REFERENCES public.signed_receipts(zapsign_token) ON DELETE SET NULL;

-- 6. Tabela de Auditoria (Logs)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  user_email text,
  user_profile text,
  action text NOT NULL,
  freelancer_id uuid,
  freelancer_name text,
  unit text,
  old_status text,
  new_status text,
  ip_address text,
  device_info text,
  gps_coordinates jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Habilitar RLS para audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para audit_logs
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='audit_logs' AND policyname='Admins/Finance/RH can view audit logs') THEN
    CREATE POLICY "Admins/Finance/RH can view audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='audit_logs' AND policyname='Allow insertions to audit logs from anyone') THEN
    CREATE POLICY "Allow insertions to audit logs from anyone" ON public.audit_logs FOR INSERT TO anon, authenticated WITH CHECK (true);
  END IF;
END
$$;

-- Criar bucket 'checkin-photos' para as fotos do check-in se não existir
INSERT INTO storage.buckets (id, name, public)
VALUES ('checkin-photos', 'checkin-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Criar bucket 'payment-vouchers' para comprovantes de pagamento se não existir
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-vouchers', 'payment-vouchers', false)
ON CONFLICT (id) DO NOTHING;

-- Criar políticas para storage.objects para checkin-photos
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND schemaname='storage' AND policyname='Allow public upload to checkin-photos') THEN
    CREATE POLICY "Allow public upload to checkin-photos" ON storage.objects FOR INSERT TO anon WITH CHECK (bucket_id = 'checkin-photos');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND schemaname='storage' AND policyname='Allow public read from checkin-photos') THEN
    CREATE POLICY "Allow public read from checkin-photos" ON storage.objects FOR SELECT TO anon USING (bucket_id = 'checkin-photos');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND schemaname='storage' AND policyname='Allow authenticated manage checkin-photos') THEN
    CREATE POLICY "Allow authenticated manage checkin-photos" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'checkin-photos');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND schemaname='storage' AND policyname='Allow authenticated manage payment-vouchers') THEN
    CREATE POLICY "Allow authenticated manage payment-vouchers" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'payment-vouchers');
  END IF;
END
$$;

