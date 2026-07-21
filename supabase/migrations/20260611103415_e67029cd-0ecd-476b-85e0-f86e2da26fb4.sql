
CREATE TABLE public.employee_admission_registry (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  cpf text NOT NULL DEFAULT '',
  pix text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  telefone text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'Operador',
  endereco text NOT NULL DEFAULT '',
  rg text NOT NULL DEFAULT '',
  estado_civil text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_admission_registry TO authenticated;
GRANT ALL ON public.employee_admission_registry TO service_role;

ALTER TABLE public.employee_admission_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view employee_admission_registry"
  ON public.employee_admission_registry FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert employee_admission_registry"
  ON public.employee_admission_registry FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update employee_admission_registry"
  ON public.employee_admission_registry FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admins delete employee_admission_registry"
  ON public.employee_admission_registry FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE TRIGGER update_employee_admission_registry_updated_at
  BEFORE UPDATE ON public.employee_admission_registry
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
