-- Migration: Create employee_admission_registry table

CREATE TABLE IF NOT EXISTS public.employee_admission_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
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

ALTER TABLE public.employee_admission_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view employee admission registry"
  ON public.employee_admission_registry FOR SELECT USING (true);
CREATE POLICY "Anyone can insert employee admission registry"
  ON public.employee_admission_registry FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update employee admission registry"
  ON public.employee_admission_registry FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete employee admission registry"
  ON public.employee_admission_registry FOR DELETE USING (true);

CREATE TRIGGER update_employee_admission_registry_updated_at
  BEFORE UPDATE ON public.employee_admission_registry
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
