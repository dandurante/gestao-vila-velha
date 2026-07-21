CREATE OR REPLACE FUNCTION public.send_to_zapsign(api_key text, payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  raw_response RECORD;
BEGIN
  SELECT * INTO raw_response FROM extensions.http((
    'POST',
    'https://api.zapsign.com.br/api/v1/docs/',
    ARRAY[extensions.http_header('Authorization', 'Bearer ' || api_key)],
    'application/json',
    payload::text
  )::extensions.http_request);

  RETURN raw_response.content::jsonb;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_zapsign_doc(api_key text, doc_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  raw_response RECORD;
BEGIN
  SELECT * INTO raw_response FROM extensions.http((
    'GET',
    'https://api.zapsign.com.br/api/v1/docs/' || doc_token || '/',
    ARRAY[extensions.http_header('Authorization', 'Bearer ' || api_key)],
    NULL,
    NULL
  )::extensions.http_request);

  RETURN raw_response.content::jsonb;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.send_to_zapsign(text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_zapsign_doc(text, text) TO authenticated;