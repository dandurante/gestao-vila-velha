ALTER TABLE public.freelancer_registry 
ADD COLUMN IF NOT EXISTS role text;

CREATE TABLE IF NOT EXISTS public.vagas_email_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    welcome_text TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

GRANT SELECT ON public.vagas_email_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vagas_email_settings TO authenticated;
GRANT ALL ON public.vagas_email_settings TO service_role;

INSERT INTO public.vagas_email_settings (id, welcome_text)
VALUES (
    'd83d1c4a-c0e8-469b-8664-927a68d2090c',
    'BEM-VINDO(A)!

Recebemos sua manifestação de interesse na oportunidade de prestação de serviços autônomos disponibilizada pela DEX Invest Comércio e Varejo Ltda. e/ou Star Gold Serviços Operacionais Ltda.

A partir deste momento, você iniciará o processo de cadastro e análise documental para eventual habilitação em nosso sistema de oportunidades.

Importante: a candidatura realizada não garante contratação, convocação, aprovação, disponibilização de vagas ou prestação imediata de serviços.

O objetivo deste cadastro é verificar se você atende aos requisitos mínimos para integrar nosso banco de prestadores de serviços autônomos.

Durante o processo, poderão ser solicitados documentos pessoais, validações de identidade, informações cadastrais e demais documentos necessários ao cumprimento das exigências legais, operacionais e de segurança.

Caso seu cadastro seja aprovado, você receberá acesso à plataforma operacional, onde serão disponibilizadas oportunidades de prestação de serviços compatíveis com seu perfil.

As oportunidades serão disponibilizadas de acordo com critérios operacionais, demanda das unidades, região de atuação, disponibilidade de vagas e demais requisitos técnicos.

Você terá total liberdade para:

- aceitar ou recusar oportunidades de prestação de serviços;

- permanecer conectado ou desconectado da plataforma quando desejar;

- prestar serviços para outras empresas ou clientes;

- escolher os dias, horários e regiões de sua preferência, quando compatíveis com as oportunidades disponíveis.

O acesso à plataforma não gera garantia de disponibilização de oportunidades, remuneração mínima, exclusividade, jornada de trabalho ou qualquer vínculo empregatício, constituindo-se apenas em ferramenta tecnológica destinada à aproximação entre profissionais autônomos cadastrados e oportunidades de prestação de serviços eventualmente disponíveis.

Ao prosseguir com seu cadastro, você declara que leu e concorda com o Manual Corporativo de Governança para Prestadores de Serviços Autônomos, com o Contrato de Prestação de Serviços, com a Política de Privacidade, com o Código de Conduta, com a Política Antifraude e com os demais documentos institucionais disponibilizados pela CONTRATANTE.

Desejamos sucesso em seu processo de habilitação e agradecemos seu interesse em integrar nossa rede de prestadores de serviços.'
)
ON CONFLICT (id) DO UPDATE SET welcome_text = EXCLUDED.welcome_text;

CREATE TABLE IF NOT EXISTS public.vagas_welcome_consent (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    freelancer_id UUID REFERENCES public.freelancer_registry(id) ON DELETE SET NULL,
    email TEXT NOT NULL,
    welcome_text TEXT NOT NULL,
    sent_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    accepted_at TIMESTAMPTZ,
    ip_address TEXT
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vagas_welcome_consent TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vagas_welcome_consent TO authenticated;
GRANT ALL ON public.vagas_welcome_consent TO service_role;

ALTER TABLE public.vagas_email_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vagas_welcome_consent ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to vagas_email_settings" ON public.vagas_email_settings;
CREATE POLICY "Allow public read access to vagas_email_settings"
ON public.vagas_email_settings FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Allow authenticated manage access to vagas_email_settings" ON public.vagas_email_settings;
CREATE POLICY "Allow authenticated manage access to vagas_email_settings"
ON public.vagas_email_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read/update/insert to vagas_welcome_consent" ON public.vagas_welcome_consent;
CREATE POLICY "Allow public read/update/insert to vagas_welcome_consent"
ON public.vagas_welcome_consent FOR ALL TO public USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.validate_vaga_cpf(p_cpf text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  f_rec record;
BEGIN
  p_cpf := regexp_replace(p_cpf, '\D', '', 'g');
  SELECT id, nome, role, email, COALESCE(active, true) AS active
  INTO f_rec
  FROM public.freelancer_registry
  WHERE regexp_replace(cpf, '\D', '', 'g') = p_cpf
  LIMIT 1;
  IF f_rec.id IS NULL THEN
    RETURN jsonb_build_object('found', false, 'reason', 'Prestador de serviço não localizado. Faça o cadastro na administração.');
  END IF;
  IF NOT f_rec.active THEN
    RETURN jsonb_build_object('found', true, 'valid', false, 'reason', 'Este cadastro de prestador está inativo.');
  END IF;
  IF f_rec.role IS NULL OR f_rec.role NOT IN ('Operador', 'Entregador') THEN
    RETURN jsonb_build_object('found', true, 'valid', false, 'reason', 'Cadastro sem função de Operador ou Entregador atribuída.');
  END IF;
  RETURN jsonb_build_object(
    'found', true,
    'valid', true,
    'id', f_rec.id,
    'nome', f_rec.nome,
    'role', f_rec.role,
    'email', f_rec.email
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_vaga_cpf(text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';