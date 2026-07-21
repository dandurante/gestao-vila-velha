CREATE TABLE public.password_setup_status (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.password_setup_status TO authenticated;
GRANT ALL ON public.password_setup_status TO service_role;

ALTER TABLE public.password_setup_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own password setup status"
ON public.password_setup_status
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can complete their own password setup"
ON public.password_setup_status
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id AND completed = true);

INSERT INTO public.password_setup_status (user_id, completed, completed_at)
SELECT
  id,
  lower(email) = 'dandurante@hotmail.com',
  CASE WHEN lower(email) = 'dandurante@hotmail.com' THEN now() ELSE NULL END
FROM auth.users
ON CONFLICT (user_id) DO UPDATE
SET completed = EXCLUDED.completed,
    completed_at = EXCLUDED.completed_at,
    updated_at = now();

CREATE OR REPLACE FUNCTION public.initialize_password_setup_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.password_setup_status (user_id, completed, completed_at)
  VALUES (
    NEW.id,
    lower(NEW.email) = 'dandurante@hotmail.com',
    CASE WHEN lower(NEW.email) = 'dandurante@hotmail.com' THEN now() ELSE NULL END
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER initialize_password_setup_after_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.initialize_password_setup_status();

CREATE TRIGGER update_password_setup_status_updated_at
BEFORE UPDATE ON public.password_setup_status
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();