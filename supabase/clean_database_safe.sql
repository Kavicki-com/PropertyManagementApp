-- Script SEGURO para limpar o banco de dados
-- Execute este script no SQL Editor do Supabase
--
-- Este script oferece opções para limpar dados específicos,
-- mantendo alguns dados importantes se necessário.

-- ============================================
-- OPÇÃO 1: Limpar apenas dados de negócio (mantém usuários)
-- ============================================
-- Use esta opção se quiser manter os usuários e perfis,
-- mas limpar propriedades, inquilinos, contratos e finanças

-- Descomente as linhas abaixo para executar:

/*
-- Limpar finanças
DELETE FROM public.finances;

-- Limpar contratos
DELETE FROM public.contracts;

-- Limpar inquilinos
DELETE FROM public.tenants;

-- Limpar propriedades arquivadas
DELETE FROM public.archived_properties;

-- Limpar propriedades
DELETE FROM public.properties;
*/

-- ============================================
-- OPÇÃO 2: Limpar tudo EXCETO um usuário específico
-- ============================================
-- Substitua 'uuid-do-usuario-admin' pelo UUID do usuário que deseja manter

/*
DO $$
DECLARE
    admin_user_id UUID := 'uuid-do-usuario-admin'; -- SUBSTITUA pelo UUID
BEGIN
    -- Limpar dados de negócio
    DELETE FROM public.finances;
    DELETE FROM public.contracts;
    DELETE FROM public.tenants;
    DELETE FROM public.archived_properties;
    DELETE FROM public.properties;
    
    -- Deletar profiles exceto o admin
    DELETE FROM public.profiles WHERE id != admin_user_id;
    
    -- Deletar usuários exceto o admin
    DELETE FROM auth.users WHERE id != admin_user_id;
    
    RAISE NOTICE 'Banco limpo, mantendo apenas o usuário admin';
END $$;
*/

-- ============================================
-- OPÇÃO 3: Limpar apenas uma tabela específica
-- ============================================

-- Descomente a tabela que deseja limpar:

-- DELETE FROM public.finances;
-- DELETE FROM public.contracts;
-- DELETE FROM public.tenants;
-- DELETE FROM public.archived_properties;
-- DELETE FROM public.properties;
-- DELETE FROM public.profiles;
-- DELETE FROM auth.users;

-- ============================================
-- OPÇÃO 4: Limpar dados antigos (por data)
-- ============================================
-- Exemplo: deletar finanças com mais de 1 ano

/*
DELETE FROM public.finances 
WHERE created_at < NOW() - INTERVAL '1 year';
*/

-- Exemplo: deletar propriedades arquivadas antigas

/*
DELETE FROM public.archived_properties 
WHERE archived_at < NOW() - INTERVAL '6 months';
*/

-- ============================================
-- VERIFICAÇÃO: Ver quantos registros restam
-- ============================================
SELECT 
    'auth.users' as tabela, 
    COUNT(*) as total 
FROM auth.users
UNION ALL
SELECT 
    'public.profiles' as tabela, 
    COUNT(*) as total 
FROM public.profiles
UNION ALL
SELECT 
    'public.properties' as tabela, 
    COUNT(*) as total 
FROM public.properties
UNION ALL
SELECT 
    'public.tenants' as tabela, 
    COUNT(*) as total 
FROM public.tenants
UNION ALL
SELECT 
    'public.contracts' as tabela, 
    COUNT(*) as total 
FROM public.contracts
UNION ALL
SELECT 
    'public.finances' as tabela, 
    COUNT(*) as total 
FROM public.finances
UNION ALL
SELECT 
    'public.archived_properties' as tabela, 
    COUNT(*) as total 
FROM public.archived_properties;

