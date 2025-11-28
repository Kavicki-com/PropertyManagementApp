-- Script para limpar TODOS os dados do banco de dados
-- Execute este script no SQL Editor do Supabase
--
-- ⚠️ ATENÇÃO: Este script deleta TODOS os dados de TODAS as tabelas!
-- Use apenas em desenvolvimento/teste. NUNCA execute em produção sem backup!
--
-- Este script mantém a estrutura das tabelas, apenas remove os dados.

-- ============================================
-- PARTE 1: VERIFICAÇÃO - Ver quantos registros existem
-- ============================================

-- Contar registros antes de deletar
SELECT 'Antes da limpeza:' as status;
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

-- ============================================
-- PARTE 2: LIMPEZA - Deletar dados na ordem correta
-- ============================================
-- Ordem: deletar primeiro tabelas que referenciam outras (filhas),
-- depois as tabelas referenciadas (pais)

-- 2.1. Deletar de finances (pode referenciar properties, tenants, contracts)
DELETE FROM public.finances;

-- 2.2. Deletar de contracts (pode referenciar properties e tenants)
DELETE FROM public.contracts;

-- 2.3. Deletar de tenants (pode referenciar properties)
DELETE FROM public.tenants;

-- 2.4. Deletar de archived_properties
DELETE FROM public.archived_properties;

-- 2.5. Deletar de properties
DELETE FROM public.properties;

-- 2.6. Deletar de profiles (referencia auth.users)
DELETE FROM public.profiles;

-- 2.7. Deletar de auth.users (usuários de autenticação)
-- ⚠️ CUIDADO: Isso deleta todos os usuários!
DELETE FROM auth.users;

-- ============================================
-- PARTE 3: VERIFICAÇÃO PÓS-LIMPEZA
-- ============================================

SELECT 'Após a limpeza:' as status;
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

-- ============================================
-- PARTE 4: LIMPAR STORAGE (OPCIONAL)
-- ============================================
-- ⚠️ ATENÇÃO: Para limpar o storage (imagens de propriedades),
-- você precisa usar a API do Supabase ou o Dashboard.
-- O SQL não pode deletar arquivos do storage diretamente.
--
-- Para limpar o storage via código JavaScript:
-- const { data, error } = await supabase.storage
--   .from('property-images')
--   .list();
-- 
-- for (const file of data) {
--   await supabase.storage
--     .from('property-images')
--     .remove([file.name]);
-- }

-- ============================================
-- NOTAS IMPORTANTES
-- ============================================
-- 1. Este script mantém a estrutura das tabelas (schemas, constraints, etc)
-- 2. Para resetar completamente (incluindo estrutura), você precisaria dropar as tabelas
-- 3. As sequências (auto-increment) NÃO são resetadas automaticamente
-- 4. Para resetar sequências também, execute a PARTE 5 abaixo

-- ============================================
-- PARTE 5: RESETAR SEQUÊNCIAS (OPCIONAL)
-- ============================================
-- Descomente se quiser resetar os contadores de ID também

-- Resetar sequências (ajuste os nomes conforme suas tabelas)
-- ALTER SEQUENCE IF EXISTS public.properties_id_seq RESTART WITH 1;
-- ALTER SEQUENCE IF EXISTS public.tenants_id_seq RESTART WITH 1;
-- ALTER SEQUENCE IF EXISTS public.contracts_id_seq RESTART WITH 1;
-- ALTER SEQUENCE IF EXISTS public.finances_id_seq RESTART WITH 1;

