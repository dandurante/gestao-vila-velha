CREATE OR REPLACE FUNCTION public.get_zapsign_doc(api_key text, doc_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  raw_response RECORD;
BEGIN
  SELECT * INTO raw_response FROM http((
    'GET',
    'https://api.zapsign.com.br/api/v1/docs/' || doc_token || '/',
    ARRAY[http_header('Authorization', 'Bearer ' || api_key)],
    NULL,
    NULL
  )::http_request);
  
  RETURN raw_response.content::jsonb;
END;
$function$;