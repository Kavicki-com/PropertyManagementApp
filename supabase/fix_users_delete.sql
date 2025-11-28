-- Script para permitir deleção de dados na tabela users
-- Execute este script no SQL Editor do Supabase
--
-- ⚠️ ATENÇÃO: Este script assume que existe uma tabela public.users
-- Se você receber erro "relation does not exist", use os scripts:
-- - delete_users_correct.sql (para auth.users)
-- - enable_profiles_delete.sql (para public.profiles)

-- ============================================
-- PARTE 1: DIAGNÓSTICO
-- ============================================
-- Execute estas queries primeiro para entender o problema:

-- 1. Verificar se a tabela users existe e sua estrutura
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'users';

-- Se a query acima não retornar resultados, a tabela public.users não existe!
-- Nesse caso, verifique se você precisa trabalhar com:
-- - auth.users (usuários de autenticação)
-- - public.profiles (perfis de usuário)

-- 2. Verificar se RLS está habilitado na tabela users
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'users';

-- 3. Verificar políticas RLS existentes na tabela users
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'users';

-- 4. Verificar foreign keys que referenciam a tabela users
SELECT
    tc.table_name AS foreign_table_name,
    kcu.column_name AS foreign_column_name,
    ccu.table_name AS referenced_table_name,
    ccu.column_name AS referenced_column_name,
    tc.constraint_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND ccu.table_name = 'users';

-- ============================================
-- PARTE 2: SOLUÇÕES
-- ============================================

-- OPÇÃO 1: Se RLS está habilitado e não há política de DELETE
-- Criar política que permite deleção (ajuste conforme necessário)

-- Política para permitir que usuários deletem seus próprios registros
CREATE POLICY "Users can delete their own data"
ON public.users
FOR DELETE
USING (auth.uid() = id);

-- OU: Política para permitir deleção por qualquer usuário autenticado
-- CREATE POLICY "Authenticated users can delete users"
-- ON public.users
-- FOR DELETE
-- TO authenticated
-- USING (true);

-- OU: Política para permitir deleção por administradores
-- CREATE POLICY "Admins can delete users"
-- ON public.users
-- FOR DELETE
-- TO authenticated
-- USING (
--     EXISTS (
--         SELECT 1 FROM public.profiles
--         WHERE profiles.id = auth.uid()
--         AND profiles.role = 'admin'
--     )
-- );

-- OPÇÃO 2: Se você quer desabilitar RLS temporariamente (NÃO RECOMENDADO PARA PRODUÇÃO)
-- ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- OPÇÃO 3: Se você quer permitir deleção sem RLS (apenas para desenvolvimento)
-- Primeiro, desabilite RLS:
-- ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
-- Depois, remova todas as políticas:
-- DROP POLICY IF EXISTS "Users can delete their own data" ON public.users;
-- DROP POLICY IF EXISTS "Authenticated users can delete users" ON public.users;
-- DROP POLICY IF EXISTS "Admins can delete users" ON public.users;

-- ============================================
-- PARTE 3: SE HÁ FOREIGN KEYS BLOQUEANDO
-- ============================================

-- Se houver foreign keys referenciando users, você precisa:
-- 1. Deletar os registros relacionados primeiro, OU
-- 2. Configurar CASCADE na foreign key (permite deleção em cascata)

-- Exemplo: Se a tabela profiles referencia users
-- Verificar constraint atual:
-- SELECT constraint_name, delete_rule
-- FROM information_schema.referential_constraints
-- WHERE constraint_schema = 'public'
-- AND unique_constraint_name IN (
--     SELECT constraint_name
--     FROM information_schema.table_constraints
--     WHERE table_name = 'users'
--     AND constraint_type = 'PRIMARY KEY'
-- );

-- Para alterar uma foreign key para CASCADE (substitua 'nome_da_constraint' pelo nome real):
-- ALTER TABLE public.profiles
-- DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;
-- 
-- ALTER TABLE public.profiles
-- ADD CONSTRAINT profiles_user_id_fkey
-- FOREIGN KEY (user_id) REFERENCES public.users(id)
-- ON DELETE CASCADE;

-- ============================================
-- PARTE 4: NOTA SOBRE auth.users
-- ============================================
-- Se você está tentando deletar da tabela auth.users (tabela do sistema de autenticação),
-- você deve usar a função admin do Supabase:
-- 
-- SELECT auth.delete_user('user-uuid-here');
-- 
-- OU através da API Admin do Supabase (requer service_role key)

