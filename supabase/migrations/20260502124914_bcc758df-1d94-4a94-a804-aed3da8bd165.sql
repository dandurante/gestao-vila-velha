CREATE TABLE public.signed_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zapsign_token text UNIQUE NOT NULL,
  freelancer_name text NOT NULL,
  freelancer_cpf text,
  freelancer_email text,
  role text,
  unit text,
  amount numeric NOT NULL DEFAULT 0,
  reference_period text,
  signed_file_url text,
  status text NOT NULL DEFAULT 'signed',
  signed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.signed_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view signed receipts" ON public.signed_receipts FOR SELECT USING (true);
CREATE POLICY "Anyone can insert signed receipts" ON public.signed_receipts FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update signed receipts" ON public.signed_receipts FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete signed receipts" ON public.signed_receipts FOR DELETE USING (true);

CREATE INDEX idx_signed_receipts_signed_at ON public.signed_receipts(signed_at DESC);
CREATE INDEX idx_signed_receipts_freelancer_name ON public.signed_receipts(freelancer_name);

CREATE TRIGGER update_signed_receipts_updated_at
BEFORE UPDATE ON public.signed_receipts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();