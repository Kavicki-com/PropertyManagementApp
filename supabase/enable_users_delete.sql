-- Script rápido para habilitar deleção na tabela users
-- Execute este script no SQL Editor do Supabase
--
-- ⚠️ ATENÇÃO: Este script assume que existe uma tabela public.users
-- Se você receber erro "relation does not exist", use os scripts:
-- - delete_users_correct.sql (para auth.users)
-- - enable_profiles_delete.sql (para public.profiles)

-- ============================================
-- VERIFICAÇÃO: Verificar se a tabela existe
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
    ) THEN
        RAISE EXCEPTION 'A tabela public.users não existe! Use delete_users_correct.sql para auth.users ou enable_profiles_delete.sql para profiles';
    END IF;
END $$;

-- ============================================
-- SOLUÇÃO RÁPIDA: Permitir deleção para usuários autenticados
-- ============================================

-- 1. Verificar se RLS está habilitado
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'users'
        AND rowsecurity = true
    ) THEN
        RAISE NOTICE 'RLS está habilitado na tabela users';
        
        -- Remover políticas de DELETE existentes (se houver)
        DROP POLICY IF EXISTS "Users can delete their own data" ON public.users;
        DROP POLICY IF EXISTS "Authenticated users can delete users" ON public.users;
        DROP POLICY IF EXISTS "Admins can delete users" ON public.users;
        DROP POLICY IF EXISTS "Enable delete for users" ON public.users;
        
        -- Criar nova política permissiva para DELETE
        CREATE POLICY "Enable delete for users"
        ON public.users
        FOR DELETE
        TO authenticated
        USING (true);
        
        RAISE NOTICE 'Política de DELETE criada com sucesso';
    ELSE
        RAISE NOTICE 'RLS não está habilitado na tabela users';
    END IF;
END $$;

-- ============================================
-- ALTERNATIVA: Desabilitar RLS (apenas desenvolvimento)
-- ============================================
-- Descomente a linha abaixo se quiser desabilitar RLS completamente
-- (NÃO RECOMENDADO PARA PRODUÇÃO)
-- ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- ============================================
-- VERIFICAÇÃO: Testar se a deleção funciona
-- ============================================
-- Após executar o script acima, teste com:
-- DELETE FROM public.users WHERE id = 'seu-user-id-aqui';

