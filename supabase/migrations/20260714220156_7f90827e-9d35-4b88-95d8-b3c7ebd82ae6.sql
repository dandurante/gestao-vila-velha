
CREATE OR REPLACE FUNCTION public.validate_vaga_cpf(p_cpf text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  f_rec record;
BEGIN
  p_cpf := regexp_replace(p_cpf, '\D', '', 'g');

  SELECT id, nome, role, email, COALESCE(active, true) AS active
  INTO f_rec
  FROM public.freelancer_registry
  WHERE regexp_replace(cpf, '\D', '', 'g') = p_cpf
  LIMIT 1;

  IF f_rec.id IS NULL THEN
    RETURN jsonb_build_object('found', false, 'reason', 'Prestador de serviço não localizado. Faça o cadastro na administração.');
  END IF;

  IF NOT f_rec.active THEN
    RETURN jsonb_build_object('found', true, 'valid', false, 'reason', 'Este cadastro de prestador está inativo.');
  END IF;

  IF f_rec.role IS NULL OR f_rec.role NOT IN ('Operador', 'Entregador') THEN
    RETURN jsonb_build_object('found', true, 'valid', false, 'reason', 'Cadastro sem função de Operador ou Entregador atribuída.');
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'valid', true,
    'id', f_rec.id,
    'nome', f_rec.nome,
    'role', f_rec.role,
    'email', f_rec.email
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_vaga_cpf(text) TO anon, authenticated;
