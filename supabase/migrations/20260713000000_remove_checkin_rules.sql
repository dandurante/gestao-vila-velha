-- Atualiza a função validate_checkin_cpf para remover as regras:
-- 2. Contrato assinado e vigente
-- 3. Sem recibos atrasados

CREATE OR REPLACE FUNCTION public.validate_checkin_cpf(p_cpf text)
RETURNS jsonb
SECURITY DEFINER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  f_rec record;
BEGIN
  -- Limpar caracteres do CPF
  p_cpf := regexp_replace(p_cpf, '\D', '', 'g');

  -- Buscar prestador cadastrado no cadastro de prestadores (freelancers)
  SELECT * INTO f_rec FROM public.freelancer_registry
  WHERE regexp_replace(cpf, '\D', '', 'g') = p_cpf LIMIT 1;

  IF f_rec.id IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'Prestador não cadastrado.');
  END IF;

  -- Verificar se está ativo
  IF NOT COALESCE(f_rec.active, true) THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'Prestador inativo.');
  END IF;

  -- Retornar sucesso com os dados mínimos
  RETURN jsonb_build_object(
    'valid', true,
    'freelancer_id', f_rec.id,
    'nome', f_rec.nome,
    'role', f_rec.role
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_checkin_cpf(text) TO anon, authenticated;
