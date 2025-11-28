-- Script para habilitar deleção na tabela profiles
-- Execute este script no SQL Editor do Supabase

-- ============================================
-- SOLUÇÃO: Habilitar deleção em profiles
-- ============================================

-- 1. Verificar se a tabela profiles existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'profiles'
    ) THEN
        RAISE EXCEPTION 'A tabela profiles não existe no schema public';
    END IF;
    
    RAISE NOTICE 'Tabela profiles encontrada';
END $$;

-- 2. Verificar e configurar RLS
DO $$
BEGIN
    -- Verificar se RLS está habilitado
    IF EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'profiles'
        AND rowsecurity = true
    ) THEN
        RAISE NOTICE 'RLS está habilitado na tabela profiles';
        
        -- Remover políticas de DELETE existentes (se houver)
        DROP POLICY IF EXISTS "Users can delete their own profile" ON public.profiles;
        DROP POLICY IF EXISTS "Authenticated users can delete profiles" ON public.profiles;
        DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
        DROP POLICY IF EXISTS "Enable delete for profiles" ON public.profiles;
        
        -- Criar nova política permissiva para DELETE
        CREATE POLICY "Enable delete for profiles"
        ON public.profiles
        FOR DELETE
        TO authenticated
        USING (true);
        
        RAISE NOTICE 'Política de DELETE criada com sucesso';
    ELSE
        RAISE NOTICE 'RLS não está habilitado na tabela profiles';
        RAISE NOTICE 'Você pode deletar diretamente sem políticas RLS';
    END IF;
END $$;

-- ============================================
-- VERIFICAÇÃO: Listar políticas existentes
-- ============================================
SELECT 
    policyname,
    cmd,
    roles,
    qual
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'profiles'
ORDER BY policyname;

-- ============================================
-- TESTE: Deletar um perfil (substitua o ID)
-- ============================================
-- DELETE FROM public.profiles WHERE id = 'seu-user-id-aqui';

