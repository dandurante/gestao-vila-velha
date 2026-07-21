DROP TABLE IF EXISTS public.termo_adesao_logs;

CREATE TABLE public.termo_adesao_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    freelancer_id TEXT,
    freelancer_nome TEXT NOT NULL,
    freelancer_cpf TEXT NOT NULL,
    accepted_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

GRANT ALL ON public.termo_adesao_logs TO anon;
GRANT ALL ON public.termo_adesao_logs TO authenticated;
GRANT ALL ON public.termo_adesao_logs TO service_role;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;

ALTER TABLE public.termo_adesao_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all actions on termo_adesao_logs"
ON public.termo_adesao_logs
FOR ALL
TO public
USING (true)
WITH CHECK (true);

NOTIFY pgrst, 'reload schema';