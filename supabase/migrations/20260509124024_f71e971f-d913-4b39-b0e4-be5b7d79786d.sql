
-- 1. Enum de perfis
CREATE TYPE public.app_role AS ENUM ('admin', 'gestor_loja', 'financeiro', 'rh');

-- 2. Tabela user_roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Função has_role (security definer, evita recursão)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 4. Função is_admin helper
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'admin'
  )
$$;

-- 5. RLS user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE POLICY "Only admins can manage roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- 6. Lojas atribuídas a gestores
CREATE TABLE public.user_store_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  unit TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, unit)
);

ALTER TABLE public.user_store_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own store assignments"
  ON public.user_store_assignments FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE POLICY "Only admins manage store assignments"
  ON public.user_store_assignments FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- 7. Helper: verifica se usuário tem acesso à loja
CREATE OR REPLACE FUNCTION public.user_has_store_access(_user_id UUID, _unit TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin(_user_id)
    OR public.has_role(_user_id, 'financeiro')
    OR public.has_role(_user_id, 'rh')
    OR EXISTS (
      SELECT 1 FROM public.user_store_assignments
      WHERE user_id = _user_id AND unit = _unit
    )
$$;

-- 8. Tabela de contratos
CREATE TABLE public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  freelancer_id UUID REFERENCES public.freelancer_registry(id) ON DELETE SET NULL,
  freelancer_name TEXT NOT NULL,
  freelancer_cpf TEXT,
  freelancer_email TEXT,
  unit TEXT,
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('rascunho','pendente','assinado','recusado','vencido','cancelado')),
  zapsign_token TEXT,
  signed_file_url TEXT,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  signed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_contracts_status ON public.contracts(status);
CREATE INDEX idx_contracts_unit ON public.contracts(unit);
CREATE INDEX idx_contracts_issued_at ON public.contracts(issued_at);
CREATE INDEX idx_contracts_freelancer ON public.contracts(freelancer_id);

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

-- Leitura: admin, financeiro, rh veem tudo. Gestor de loja vê apenas suas lojas. Outros autenticados também (compat).
CREATE POLICY "Authenticated users can view contracts"
  ON public.contracts FOR SELECT
  TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.has_role(auth.uid(), 'financeiro')
    OR public.has_role(auth.uid(), 'rh')
    OR (unit IS NOT NULL AND public.user_has_store_access(auth.uid(), unit))
    OR NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid())
  );

CREATE POLICY "Authenticated users can insert contracts"
  ON public.contracts FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin(auth.uid())
    OR public.has_role(auth.uid(), 'rh')
    OR (unit IS NOT NULL AND public.user_has_store_access(auth.uid(), unit))
    OR NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid())
  );

CREATE POLICY "Authenticated users can update contracts"
  ON public.contracts FOR UPDATE
  TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.has_role(auth.uid(), 'rh')
    OR (unit IS NOT NULL AND public.user_has_store_access(auth.uid(), unit))
    OR NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid())
  );

CREATE POLICY "Only admins can delete contracts"
  ON public.contracts FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Trigger updated_at
CREATE TRIGGER contracts_updated_at
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
