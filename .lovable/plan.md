## Causa

A política RLS de `checkin_restrictions` exige `is_admin(auth.uid())` para INSERT/UPDATE/DELETE. Quando o usuário logado não é admin, o Supabase descarta a operação silenciosamente (RLS não lança exceção — só não afeta linhas). O handler `handleToggleRestriction` não captura o `error` retornado e mostra "desabilitado com sucesso" mesmo quando nada foi gravado.

## Correção

1. **Migração**: substituir as políticas restritivas de `checkin_restrictions` por políticas que permitem a usuários autenticados (qualquer perfil que acessa o Controle Operacional) gerenciar bloqueios — alinhado com o restante das tabelas operacionais (`freelancers`, `check_ins`).
2. **Frontend** (`src/routes/controle-operacional.tsx`): em `handleToggleRestriction`, desestruturar `{ error }` de cada chamada `upsert`/`delete` e lançar exceção se houver erro, para que o `try/catch` mostre o erro real em vez de um sucesso falso.
