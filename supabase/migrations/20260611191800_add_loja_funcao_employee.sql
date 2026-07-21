-- Adicionar colunas loja e funcao na tabela employee_admission_registry
ALTER TABLE public.employee_admission_registry
  ADD COLUMN IF NOT EXISTS loja text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS funcao text NOT NULL DEFAULT '';
