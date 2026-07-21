CREATE TABLE public.cash_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  unit TEXT NOT NULL,
  cash_in NUMERIC(12,2) NOT NULL DEFAULT 0,
  cash_deposited NUMERIC(12,2) NOT NULL DEFAULT 0,
  expense_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  expense_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_cash_entries_date ON public.cash_entries(entry_date DESC);
CREATE INDEX idx_cash_entries_unit ON public.cash_entries(unit);

ALTER TABLE public.cash_entries ENABLE ROW LEVEL SECURITY;

-- Public access policies (no authentication required for this internal tool)
CREATE POLICY "Anyone can view cash entries"
  ON public.cash_entries FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert cash entries"
  ON public.cash_entries FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update cash entries"
  ON public.cash_entries FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete cash entries"
  ON public.cash_entries FOR DELETE
  USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_cash_entries_updated_at
  BEFORE UPDATE ON public.cash_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();