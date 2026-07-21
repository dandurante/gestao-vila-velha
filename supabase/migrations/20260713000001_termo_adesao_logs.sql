-- Create table for Termo de Adesão logs
CREATE TABLE IF NOT EXISTS public.termo_adesao_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    freelancer_id UUID REFERENCES public.freelancer_registry(id),
    freelancer_nome TEXT NOT NULL,
    freelancer_cpf TEXT NOT NULL,
    accepted_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.termo_adesao_logs ENABLE ROW LEVEL SECURITY;

-- Policy to allow anyone to insert (since freelancers are not logged in as auth users)
CREATE POLICY "Allow anonymous insert to termo_adesao_logs" 
ON public.termo_adesao_logs 
FOR INSERT 
TO public
WITH CHECK (true);

-- Policy to allow authenticated users (managers) to select
CREATE POLICY "Allow authenticated select to termo_adesao_logs" 
ON public.termo_adesao_logs 
FOR SELECT 
TO authenticated 
USING (true);
