
CREATE TABLE public.attendance_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit TEXT NOT NULL,
  name TEXT NOT NULL,
  cpf TEXT,
  regime TEXT NOT NULL DEFAULT 'CLT',
  status TEXT NOT NULL DEFAULT 'OK',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.attendance_employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone view attendance_employees" ON public.attendance_employees FOR SELECT USING (true);
CREATE POLICY "Anyone insert attendance_employees" ON public.attendance_employees FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone update attendance_employees" ON public.attendance_employees FOR UPDATE USING (true);
CREATE POLICY "Anyone delete attendance_employees" ON public.attendance_employees FOR DELETE USING (true);
CREATE TRIGGER set_updated_at_attendance_employees BEFORE UPDATE ON public.attendance_employees FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_att_emp_unit ON public.attendance_employees(unit);

CREATE TABLE public.attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.attendance_employees(id) ON DELETE CASCADE,
  unit TEXT NOT NULL,
  entry_date DATE NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(employee_id, entry_date)
);
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone view attendance_records" ON public.attendance_records FOR SELECT USING (true);
CREATE POLICY "Anyone insert attendance_records" ON public.attendance_records FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone update attendance_records" ON public.attendance_records FOR UPDATE USING (true);
CREATE POLICY "Anyone delete attendance_records" ON public.attendance_records FOR DELETE USING (true);
CREATE TRIGGER set_updated_at_attendance_records BEFORE UPDATE ON public.attendance_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_att_rec_unit_date ON public.attendance_records(unit, entry_date);
CREATE INDEX idx_att_rec_employee ON public.attendance_records(employee_id);
