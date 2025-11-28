-- Script para deletar usuários do Supabase
-- Execute este script no SQL Editor do Supabase
-- 
-- IMPORTANTE: No Supabase, os usuários de autenticação estão em auth.users,
-- não em public.users. Este script trabalha com auth.users.

-- ============================================
-- PARTE 1: DIAGNÓSTICO - Verificar tabelas existentes
-- ============================================

-- Verificar todas as tabelas relacionadas a usuários
SELECT 
    schemaname,
    tablename,
    tableowner
FROM pg_tables 
WHERE (schemaname = 'public' AND tablename IN ('users', 'profiles'))
   OR (schemaname = 'auth' AND tablename = 'users')
ORDER BY schemaname, tablename;

-- Verificar estrutura da tabela profiles (se existir)
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'profiles'
ORDER BY ordinal_position;

-- ============================================
-- PARTE 2: DELETAR DE auth.users (MÉTODO RECOMENDADO)
-- ============================================

-- MÉTODO 1: Usar função auth.delete_user() (requer permissões)
-- Substitua 'user-uuid-aqui' pelo ID do usuário que deseja deletar
-- SELECT auth.delete_user('user-uuid-aqui');

-- MÉTODO 2: Deletar diretamente de auth.users (requer permissões de admin)
-- ATENÇÃO: Isso deleta o usuário de autenticação completamente
-- DELETE FROM auth.users WHERE id = 'user-uuid-aqui';

-- MÉTODO 3: Deletar múltiplos usuários
-- DELETE FROM auth.users WHERE id IN ('uuid1', 'uuid2', 'uuid3');

-- ============================================
-- PARTE 3: DELETAR DE profiles (se necessário)
-- ============================================

-- Verificar se profiles tem RLS habilitado
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'profiles';

-- Verificar políticas RLS em profiles
SELECT 
    policyname,
    cmd,
    qual
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'profiles'
AND cmd = 'DELETE';

-- Se RLS estiver habilitado e não houver política de DELETE, criar uma:
-- CREATE POLICY "Enable delete for profiles"
-- ON public.profiles
-- FOR DELETE
-- TO authenticated
-- USING (true);

-- Deletar de profiles (faça isso ANTES de deletar de auth.users se houver foreign key)
-- DELETE FROM public.profiles WHERE id = 'user-uuid-aqui';

-- ============================================
-- PARTE 4: DELETAR EM CASCATA (profiles + auth.users)
-- ============================================

-- Script completo para deletar um usuário completamente:
-- 1. Deletar dados relacionados primeiro (se necessário)
-- 2. Deletar de profiles
-- 3. Deletar de auth.users
--
-- INSTRUÇÕES: Substitua '00000000-0000-0000-0000-000000000000' pelo UUID real do usuário
-- Exemplo de UUID válido: '123e4567-e89b-12d3-a456-426614174000'

-- MÉTODO SIMPLES: Execute estas queries na ordem (substitua o UUID):
-- 1. Deletar de profiles primeiro
-- DELETE FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000000';
-- 2. Deletar de auth.users
-- DELETE FROM auth.users WHERE id = '00000000-0000-0000-0000-000000000000';

-- MÉTODO COM FUNÇÃO (descomente e substitua o UUID):
/*
DO $$
DECLARE
    user_id_to_delete UUID := '00000000-0000-0000-0000-000000000000'; -- SUBSTITUA pelo UUID real
BEGIN
    -- Deletar de profiles primeiro (se existir)
    DELETE FROM public.profiles WHERE id = user_id_to_delete;
    RAISE NOTICE 'Perfil deletado (se existia)';
    
    -- Deletar de auth.users
    DELETE FROM auth.users WHERE id = user_id_to_delete;
    RAISE NOTICE 'Usuário de autenticação deletado';
    
    RAISE NOTICE 'Usuário deletado com sucesso!';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Erro ao deletar: %', SQLERRM;
END $$;
*/

-- ============================================
-- PARTE 5: DELETAR TODOS OS USUÁRIOS (CUIDADO!)
-- ============================================

-- ⚠️ ATENÇÃO: Use apenas em desenvolvimento/teste!
-- Descomente apenas se tiver certeza:

-- Deletar todos os profiles
-- DELETE FROM public.profiles;

-- Deletar todos os usuários de autenticação
-- DELETE FROM auth.users;

-- ============================================
-- PARTE 6: VERIFICAÇÃO PÓS-DELETAR
-- ============================================

-- Verificar quantos usuários restam
SELECT COUNT(*) as total_users FROM auth.users;
SELECT COUNT(*) as total_profiles FROM public.profiles;

