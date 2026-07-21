-- Create freelancers table for daily freelancer entries
CREATE TABLE public.freelancers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  unit TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  pix TEXT NOT NULL,
  daily_rate NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.freelancers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view freelancers"
  ON public.freelancers FOR SELECT USING (true);

CREATE POLICY "Anyone can insert freelancers"
  ON public.freelancers FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update freelancers"
  ON public.freelancers FOR UPDATE USING (true);

CREATE POLICY "Anyone can delete freelancers"
  ON public.freelancers FOR DELETE USING (true);

CREATE TRIGGER update_freelancers_updated_at
  BEFORE UPDATE ON public.freelancers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_freelancers_entry_date ON public.freelancers(entry_date);
CREATE INDEX idx_freelancers_unit ON public.freelancers(unit);
