-- Enable dandurante@hotmail.com for test access
INSERT INTO public.allowed_emails (email)
VALUES ('dandurante@hotmail.com')
ON CONFLICT (email) DO NOTHING;

-- Register test freelancer if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.freelancer_registry WHERE email = 'dandurante@hotmail.com') THEN
    INSERT INTO public.freelancer_registry (nome, cpf, email, role, active)
    VALUES ('Dan Durante', '11122233344', 'dandurante@hotmail.com', 'Operador', true);
  END IF;
END $$;
