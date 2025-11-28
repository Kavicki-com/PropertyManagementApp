# Solução: Não consigo deletar dados da tabela users

## Problema

Você está tentando deletar dados da tabela `users` no Supabase, mas está recebendo um erro ou a operação não está funcionando.

⚠️ **IMPORTANTE**: No Supabase, não existe uma tabela `public.users`. Os usuários de autenticação estão em `auth.users`, e os perfis estendidos estão em `public.profiles`.

## Causas Comuns

1. **Tabela não existe**: Você pode estar tentando deletar de `public.users` que não existe. Use `auth.users` para usuários de autenticação ou `public.profiles` para perfis.

2. **RLS (Row Level Security) habilitado sem política de DELETE**: O Supabase pode ter RLS habilitado na tabela `profiles`, mas sem uma política que permita deleção.

3. **Foreign Keys**: Outras tabelas podem estar referenciando `auth.users` ou `profiles`, impedindo a deleção.

4. **Permissões insuficientes**: Deletar de `auth.users` requer permissões especiais de administrador.

## Soluções

### Passo 1: Encontrar o UUID do usuário

Antes de deletar, você precisa do UUID do usuário:

1. Execute o script `list_users.sql` no SQL Editor do Supabase
2. Copie o UUID (id) do usuário que deseja deletar
3. Um UUID tem o formato: `123e4567-e89b-12d3-a456-426614174000`

### Solução 1: Deletar um usuário (Método Simples - Recomendado)

Execute o script `delete_user_simple.sql`:

1. Acesse o Supabase Dashboard → **SQL Editor**
2. Abra o arquivo `delete_user_simple.sql`
3. **Substitua `'SUBSTITUA-PELO-UUID-AQUI'` pelo UUID real do usuário** (copiado do passo 1)
4. Execute o script

Este script deleta de `profiles` e `auth.users` na ordem correta.

### Solução 2: Deletar de auth.users (Método Avançado)

Execute o script `delete_users_correct.sql` no SQL Editor do Supabase:

1. Acesse o Supabase Dashboard → **SQL Editor**
2. Cole o conteúdo do arquivo `delete_users_correct.sql`
3. **Substitua `'00000000-0000-0000-0000-000000000000'` pelo UUID real do usuário**
4. Execute a parte apropriada do script

Este script oferece múltiplas opções:
- Deletar um usuário específico
- Deletar múltiplos usuários
- Deletar em cascata (profiles + auth.users)

### Solução 2: Habilitar deleção em profiles

Se você quer deletar da tabela `profiles`, execute o script `enable_profiles_delete.sql`:

1. Acesse o Supabase Dashboard
2. Vá em **SQL Editor**
3. Cole o conteúdo do arquivo `enable_profiles_delete.sql`
4. Execute o script

Este script irá:
- Verificar se a tabela profiles existe
- Verificar se RLS está habilitado
- Criar uma política que permite deleção para usuários autenticados

### Se houver Foreign Keys

Se outras tabelas referenciam `auth.users` ou `profiles`, você tem duas opções:

1. **Deletar registros relacionados primeiro**:
   ```sql
   -- Exemplo: deletar profiles antes de deletar auth.users
   DELETE FROM public.profiles WHERE id = 'id-do-usuario';
   DELETE FROM auth.users WHERE id = 'id-do-usuario';
   ```

2. **Configurar CASCADE** (deleta automaticamente registros relacionados):
   ```sql
   -- Exemplo para a tabela profiles referenciando auth.users
   ALTER TABLE public.profiles
   DROP CONSTRAINT IF EXISTS profiles_id_fkey;
   
   ALTER TABLE public.profiles
   ADD CONSTRAINT profiles_id_fkey
   FOREIGN KEY (id) REFERENCES auth.users(id)
   ON DELETE CASCADE;
   ```

### Métodos para deletar de auth.users

1. **Usando função admin** (requer permissões):
   ```sql
   SELECT auth.delete_user('user-uuid-here');
   ```

2. **Deletar diretamente** (requer permissões de admin):
   ```sql
   DELETE FROM auth.users WHERE id = 'user-uuid-here';
   ```

3. **Usando API Admin** com `service_role` key (via código JavaScript/TypeScript)

## Verificação

Após executar os scripts, verifique se o usuário foi deletado:

```sql
-- Verificar se o usuário ainda existe
SELECT id, email FROM auth.users WHERE id = 'uuid-do-usuario';
SELECT id, full_name FROM public.profiles WHERE id = 'uuid-do-usuario';

-- Se não retornar resultados, o usuário foi deletado com sucesso!
```

## Exemplo Prático

1. **Listar usuários**:
   ```sql
   -- Execute list_users.sql ou:
   SELECT id, email FROM auth.users;
   ```

2. **Copiar o UUID** (exemplo: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`)

3. **Deletar o usuário**:
   ```sql
   -- Deletar de profiles primeiro
   DELETE FROM public.profiles WHERE id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
   
   -- Deletar de auth.users depois
   DELETE FROM auth.users WHERE id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
   ```

## Segurança

⚠️ **IMPORTANTE**: 
- A política criada permite que qualquer usuário autenticado delete qualquer registro da tabela `users`
- Para produção, considere criar políticas mais restritivas (ex: apenas admins podem deletar)
- Revise as políticas RLS regularmente para manter a segurança

## Próximos Passos

1. **Primeiro**: Execute `list_users.sql` para encontrar o UUID do usuário
2. **Depois**: Execute `delete_user_simple.sql` (substitua o UUID) - **Método mais fácil**
3. **Alternativa**: Se precisar de mais controle, use `delete_users_correct.sql`
4. **Se houver erro de RLS**: Execute `enable_profiles_delete.sql` primeiro
5. Ajuste as políticas conforme necessário para seu caso de uso

## Arquivos Disponíveis

- **`list_users.sql`**: Lista todos os usuários e seus UUIDs
- **`delete_user_simple.sql`**: Script simples para deletar um usuário (RECOMENDADO)
- **`delete_users_correct.sql`**: Script avançado com múltiplas opções
- **`enable_profiles_delete.sql`**: Habilita deleção na tabela profiles (se necessário)

## Estrutura do Supabase

- **`auth.users`**: Tabela do sistema de autenticação (gerenciada pelo Supabase)
- **`public.profiles`**: Tabela de perfis estendidos (criada por você)
- **`public.users`**: ❌ Esta tabela NÃO existe por padrão no Supabase

