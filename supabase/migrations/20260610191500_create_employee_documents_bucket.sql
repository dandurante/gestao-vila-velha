-- Criação do Bucket de documentos de admissão caso não exista
INSERT INTO storage.buckets (id, name, public)
VALUES ('employee-documents', 'employee-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Políticas de RLS para o bucket 'employee-documents'
CREATE POLICY "Permitir leitura de arquivos para todos autenticados"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'employee-documents');

CREATE POLICY "Permitir inserção de arquivos para todos autenticados"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'employee-documents');

CREATE POLICY "Permitir exclusão de arquivos para todos autenticados"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'employee-documents');
