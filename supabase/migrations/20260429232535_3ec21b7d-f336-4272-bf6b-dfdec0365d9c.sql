ALTER TABLE public.freelancers
  ADD COLUMN IF NOT EXISTS deliveries_count integer,
  ADD COLUMN IF NOT EXISTS deliveries_total numeric;