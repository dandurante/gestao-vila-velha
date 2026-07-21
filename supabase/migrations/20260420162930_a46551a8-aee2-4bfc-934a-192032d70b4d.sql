-- Habilita extensão HTTP (necessária para a ponte ZapSign)
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

-- Tabela: allowed_emails
CREATE TABLE IF NOT EXISTS public.allowed_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.allowed_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view allowed emails"
  ON public.allowed_emails FOR SELECT USING (true);
CREATE POLICY "Anyone can insert allowed emails"
  ON public.allowed_emails FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update allowed emails"
  ON public.allowed_emails FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete allowed emails"
  ON public.allowed_emails FOR DELETE USING (true);

-- Tabela: freelancer_registry
CREATE TABLE IF NOT EXISTS public.freelancer_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cpf text NOT NULL DEFAULT '',
  pix text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  telefone text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.freelancer_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view freelancer registry"
  ON public.freelancer_registry FOR SELECT USING (true);
CREATE POLICY "Anyone can insert freelancer registry"
  ON public.freelancer_registry FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update freelancer registry"
  ON public.freelancer_registry FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete freelancer registry"
  ON public.freelancer_registry FOR DELETE USING (true);

CREATE TRIGGER update_freelancer_registry_updated_at
  BEFORE UPDATE ON public.freelancer_registry
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Função: is_email_allowed
CREATE OR REPLACE FUNCTION public.is_email_allowed(check_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.allowed_emails
    WHERE lower(email) = lower(check_email)
  );
$$;

-- Função: send_to_zapsign (ponte HTTP para evitar CORS)
CREATE OR REPLACE FUNCTION public.send_to_zapsign(api_key text, payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  response jsonb;
BEGIN
  SELECT content::jsonb INTO response
  FROM extensions.http((
    'POST',
    'https://api.zapsign.com.br/api/v1/docs/',
    ARRAY[
      extensions.http_header('Authorization', 'Bearer ' || api_key),
      extensions.http_header('Content-Type', 'application/json')
    ],
    'application/json',
    payload::text
  )::extensions.http_request);

  RETURN response;
END;
$$;