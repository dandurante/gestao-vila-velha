
-- Remove any duplicate zapsign_token rows in contracts (keep the most recent)
DELETE FROM public.contracts a
USING public.contracts b
WHERE a.zapsign_token IS NOT NULL
  AND a.zapsign_token = b.zapsign_token
  AND a.created_at < b.created_at;

ALTER TABLE public.contracts
  ADD CONSTRAINT contracts_zapsign_token_key UNIQUE (zapsign_token);
