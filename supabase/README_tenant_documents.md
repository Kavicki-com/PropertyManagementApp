# Configuração de Documentos de Inquilinos

Este documento descreve como configurar o sistema de upload de documentos para inquilinos.

## 1. Executar Migração SQL

Execute o script SQL em `supabase/migrations/create_tenant_documents.sql` no Supabase:

1. Acesse o Supabase Dashboard
2. Vá em SQL Editor
3. Cole o conteúdo do arquivo `create_tenant_documents.sql`
4. Execute o script

Isso criará:
- A tabela `tenant_documents`
- Os índices necessários
- As políticas RLS (Row Level Security)

## 2. Criar Bucket no Storage

### Opção A: Via Dashboard do Supabase

1. Acesse o Supabase Dashboard
2. Vá em **Storage**
3. Clique em **New bucket**
4. Nome: `tenant-documents`
5. Marque como **Public bucket** (para permitir acesso às URLs públicas)
6. Clique em **Create bucket**

### Opção B: Via SQL

Execute o seguinte SQL no SQL Editor:

```sql
-- Criar bucket tenant-documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('tenant-documents', 'tenant-documents', true)
ON CONFLICT (id) DO NOTHING;
```

## 3. Configurar Políticas de Storage (RLS)

Execute o seguinte SQL para configurar as políticas de acesso ao bucket:

```sql
-- Política: Usuários podem fazer upload de arquivos para seus próprios inquilinos
CREATE POLICY "Users can upload tenant documents"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'tenant-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Política: Usuários podem visualizar documentos de seus próprios inquilinos
CREATE POLICY "Users can view tenant documents"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'tenant-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Política: Usuários podem deletar documentos de seus próprios inquilinos
CREATE POLICY "Users can delete tenant documents"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'tenant-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

## 4. Estrutura de Pastas no Storage

Os arquivos serão organizados da seguinte forma:
```
tenant-documents/
  {user_id}/
    {tenant_id}/
      {document_type}_{timestamp}.{ext}
```

Exemplo:
```
tenant-documents/
  123e4567-e89b-12d3-a456-426614174000/
    456e7890-e89b-12d3-a456-426614174001/
      cpf_1704123456789.jpg
      rg_1704123456790.png
      comprovante_renda_1704123456791.pdf
```

## 5. Tipos de Documentos Suportados

- **CPF**: Documento de CPF
- **RG**: Documento de RG
- **Comprovante de Renda**: Comprovante de renda
- **Comprovante de Residência**: Comprovante de residência
- **Contrato**: Contrato de locação
- **Outros**: Documentos customizados (permite nome personalizado)

## 6. Limitações

- **Tamanho máximo**: 10MB por arquivo
- **Tipos permitidos**: PDF, JPG, JPEG, PNG
- **Limite de documentos**: Sem limite específico (pode ser configurado se necessário)

## 7. Funcionalidades

- ✅ Upload de documentos (imagens e PDFs)
- ✅ Listagem de documentos por inquilino
- ✅ Visualização de documentos (abre no navegador/visualizador nativo)
- ✅ Exclusão de documentos
- ✅ Organização por tipo de documento
- ✅ Suporte a nomes customizados para documentos "outros"

## 8. Troubleshooting

### Erro: "Bucket não encontrado"
- Verifique se o bucket `tenant-documents` foi criado
- Verifique se o nome está correto (case-sensitive)

### Erro: "Permissão negada"
- Verifique se as políticas RLS estão configuradas corretamente
- Verifique se o usuário está autenticado

### Erro: "Tipo de arquivo não permitido"
- Verifique se o arquivo é PDF, JPG, JPEG ou PNG
- Verifique se o MIME type está correto

### Erro: "Arquivo muito grande"
- O arquivo deve ter no máximo 10MB
- Comprima imagens antes de fazer upload

