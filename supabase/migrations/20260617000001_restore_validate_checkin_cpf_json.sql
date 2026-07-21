-- Restaura validate_checkin_cpf para a versão que retorna JSONB.
--
-- As migrations 20260616163002 e 20260616163045 redefiniram a função para
-- RETURNS TABLE(id, nome, role, active). O front-end (src/routes/checkin.tsx)
-- consome `res.valid` / `res.reason` / `res.freelancer_id`, que só existem na
-- versão JSONB original (20260612000000_operational_control.sql). Com a versão
-- TABLE, `res.valid` fica undefined e TODO check-in falha com
-- "Não foi possível validar este prestador", mesmo com cadastro válido.
--
-- O tipo de retorno mudou (TABLE -> jsonb), então é preciso DROP antes do CREATE.

DROP FUNCTION IF EXISTS public.validate_checkin_cpf(text);

CREATE OR REPLACE FUNCTION public.validate_checkin_cpf(p_cpf text)
RETURNS jsonb
SECURITY DEFINER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  f_rec record;
  contract_rec record;
  pending_receipt_count int;
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

  -- Verificar contrato assinado e vigente
  SELECT * INTO contract_rec FROM public.contracts
  WHERE regexp_replace(freelancer_cpf, '\D', '', 'g') = p_cpf
    AND status = 'assinado'
    AND (expires_at IS NULL OR expires_at >= now())
  ORDER BY signed_at DESC LIMIT 1;

  IF contract_rec.id IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'Contrato pendente de assinatura ou fora da vigência.');
  END IF;

  -- Verificar recibo pendente de assinatura há mais de 3 dias
  SELECT COUNT(*)::int INTO pending_receipt_count FROM public.signed_receipts
  WHERE regexp_replace(freelancer_cpf, '\D', '', 'g') = p_cpf
    AND status IN ('pending', 'sent')
    AND created_at < (now() - interval '3 days');

  IF pending_receipt_count > 0 THEN
    RETURN jsonb_build_object(
      'valid', false,
      'reason', 'Existe recibo pendente de assinatura há mais de 3 dias. Regularize a pendência antes de realizar novo check-in.'
    );
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
