# Scripts para Limpar o Banco de Dados

## ⚠️ ATENÇÃO

Estes scripts deletam dados do banco de dados. Use com cuidado!

- **NUNCA execute em produção sem backup**
- **Sempre faça backup antes de limpar dados importantes**
- **Teste primeiro em ambiente de desenvolvimento**

## Arquivos Disponíveis

### 1. `clean_database.sql` - Limpeza Completa

Deleta **TODOS** os dados de **TODAS** as tabelas:

- `auth.users` (usuários de autenticação)
- `public.profiles` (perfis)
- `public.properties` (propriedades)
- `public.tenants` (inquilinos)
- `public.contracts` (contratos)
- `public.finances` (transações financeiras)
- `public.archived_properties` (propriedades arquivadas)

**Ordem de deleção**: O script deleta na ordem correta para respeitar foreign keys.

**Uso**: Execute quando quiser limpar completamente o banco para começar do zero.

### 2. `clean_database_safe.sql` - Limpeza Segura com Opções

Oferece múltiplas opções de limpeza:

- **Opção 1**: Limpar apenas dados de negócio (mantém usuários)
- **Opção 2**: Limpar tudo exceto um usuário admin específico
- **Opção 3**: Limpar apenas uma tabela específica
- **Opção 4**: Limpar dados antigos (por data)

**Uso**: Execute quando quiser limpeza seletiva ou manter alguns dados.

## Como Usar

### Limpeza Completa

1. Acesse o Supabase Dashboard
2. Vá em **SQL Editor**
3. Abra o arquivo `clean_database.sql`
4. **Revise cuidadosamente** o que será deletado
5. Execute o script
6. Verifique os resultados nas queries de verificação

### Limpeza Segura

1. Acesse o Supabase Dashboard
2. Vá em **SQL Editor**
3. Abra o arquivo `clean_database_safe.sql`
4. Escolha a opção desejada
5. Descomente (remova `/*` e `*/`) a seção que deseja executar
6. Se necessário, substitua valores como UUIDs
7. Execute o script

## Limpar Storage (Imagens)

Os scripts SQL **não podem** deletar arquivos do storage. Para limpar imagens:

### Via Dashboard do Supabase

1. Vá em **Storage**
2. Selecione o bucket `property-images`
3. Selecione os arquivos
4. Clique em **Delete**

### Via Código JavaScript

```javascript
// Listar todos os arquivos
const { data: files, error: listError } = await supabase.storage
  .from('property-images')
  .list();

if (listError) {
  console.error('Erro ao listar arquivos:', listError);
  return;
}

// Deletar todos os arquivos
const filePaths = files.map(file => file.name);
const { error: deleteError } = await supabase.storage
  .from('property-images')
  .remove(filePaths);

if (deleteError) {
  console.error('Erro ao deletar arquivos:', deleteError);
} else {
  console.log('Todos os arquivos deletados com sucesso!');
}
```

## Resetar Sequências (IDs)

Após limpar o banco, os IDs podem continuar incrementando de onde pararam. Para resetar:

1. Execute a **PARTE 5** do script `clean_database.sql`
2. Ou ajuste manualmente as sequências conforme necessário

## Backup Antes de Limpar

### Fazer Backup via SQL

```sql
-- Exportar dados (exemplo para properties)
COPY public.properties TO '/tmp/properties_backup.csv' WITH CSV HEADER;
```

### Fazer Backup via Dashboard

1. Vá em **Database** → **Backups**
2. Crie um backup manual
3. Ou use a funcionalidade de exportação de dados

## Verificação Pós-Limpeza

Após executar os scripts, verifique:

1. **Contagem de registros**: Execute as queries de verificação no final dos scripts
2. **Estrutura das tabelas**: Confirme que as tabelas ainda existem
3. **Constraints**: Verifique se as foreign keys e constraints estão intactas

## Problemas Comuns

### Erro: "violates foreign key constraint"

**Causa**: Tentou deletar uma tabela pai antes de deletar as tabelas filhas.

**Solução**: Use o script `clean_database.sql` que deleta na ordem correta.

### Erro: "permission denied"

**Causa**: Não tem permissão para deletar de `auth.users`.

**Solução**: Use permissões de administrador ou delete apenas de `public.profiles`.

### Dados não foram deletados

**Causa**: Pode haver RLS (Row Level Security) bloqueando.

**Solução**: Execute `enable_profiles_delete.sql` primeiro, ou desabilite RLS temporariamente.

## Estrutura das Tabelas

O script mantém a estrutura das tabelas. Se quiser deletar também a estrutura:

```sql
-- ⚠️ CUIDADO: Isso deleta as tabelas completamente!
DROP TABLE IF EXISTS public.finances CASCADE;
DROP TABLE IF EXISTS public.contracts CASCADE;
DROP TABLE IF EXISTS public.tenants CASCADE;
DROP TABLE IF EXISTS public.archived_properties CASCADE;
DROP TABLE IF EXISTS public.properties CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
-- auth.users não pode ser deletada (é do sistema)
```

## Recomendações

1. **Sempre teste primeiro** em ambiente de desenvolvimento
2. **Faça backup** antes de qualquer limpeza
3. **Use `clean_database_safe.sql`** quando possível (mais seguro)
4. **Documente** quais dados foram limpos e quando
5. **Verifique** os resultados após a limpeza

