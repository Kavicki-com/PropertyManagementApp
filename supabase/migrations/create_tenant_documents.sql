-- Criação da tabela tenant_documents
CREATE TABLE IF NOT EXISTS tenant_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('cpf', 'rg', 'comprovante_renda', 'comprovante_residencia', 'contrato', 'outros')),
  custom_name TEXT,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_tenant_documents_tenant_id ON tenant_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_documents_user_id ON tenant_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_documents_document_type ON tenant_documents(document_type);

-- Políticas RLS (Row Level Security)
ALTER TABLE tenant_documents ENABLE ROW LEVEL SECURITY;

-- Política: Usuários só podem ver documentos de inquilinos que pertencem a eles
CREATE POLICY "Users can view their own tenant documents"
  ON tenant_documents
  FOR SELECT
  USING (auth.uid() = user_id);

-- Política: Usuários só podem inserir documentos para seus próprios inquilinos
CREATE POLICY "Users can insert documents for their own tenants"
  ON tenant_documents
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM tenants
      WHERE tenants.id = tenant_documents.tenant_id
      AND tenants.user_id = auth.uid()
    )
  );

-- Política: Usuários só podem atualizar documentos de seus próprios inquilinos
CREATE POLICY "Users can update their own tenant documents"
  ON tenant_documents
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Política: Usuários só podem deletar documentos de seus próprios inquilinos
CREATE POLICY "Users can delete their own tenant documents"
  ON tenant_documents
  FOR DELETE
  USING (auth.uid() = user_id);

-- Comentários para documentação
COMMENT ON TABLE tenant_documents IS 'Armazena documentos dos inquilinos (CPF, RG, comprovantes, contratos, etc.)';
COMMENT ON COLUMN tenant_documents.document_type IS 'Tipo predefinido do documento';
COMMENT ON COLUMN tenant_documents.custom_name IS 'Nome customizado quando document_type é "outros"';
COMMENT ON COLUMN tenant_documents.file_url IS 'URL do arquivo no Supabase Storage';

