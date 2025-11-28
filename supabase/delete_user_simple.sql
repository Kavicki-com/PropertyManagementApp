-- Script SIMPLES para deletar um usuário específico
-- Execute este script no SQL Editor do Supabase
--
-- INSTRUÇÕES:
-- 1. Substitua 'SUBSTITUA-PELO-UUID-AQUI' pelo UUID real do usuário
-- 2. Um UUID válido tem o formato: '123e4567-e89b-12d3-a456-426614174000'
-- 3. Você pode encontrar o UUID do usuário na tabela auth.users

-- ============================================
-- OPÇÃO 1: Deletar apenas de profiles
-- ============================================
-- DELETE FROM public.profiles WHERE id = 'SUBSTITUA-PELO-UUID-AQUI';

-- ============================================
-- OPÇÃO 2: Deletar apenas de auth.users
-- ============================================
-- DELETE FROM auth.users WHERE id = 'SUBSTITUA-PELO-UUID-AQUI';

-- ============================================
-- OPÇÃO 3: Deletar de ambos (recomendado)
-- ============================================
-- Execute na ordem: primeiro profiles, depois auth.users

-- Passo 1: Deletar de profiles
DELETE FROM public.profiles WHERE id = 'SUBSTITUA-PELO-UUID-AQUI';

-- Passo 2: Deletar de auth.users
DELETE FROM auth.users WHERE id = 'SUBSTITUA-PELO-UUID-AQUI';

-- ============================================
-- COMO ENCONTRAR O UUID DE UM USUÁRIO
-- ============================================
-- Execute esta query para listar todos os usuários e seus UUIDs:
-- SELECT id, email, created_at FROM auth.users ORDER BY created_at DESC;

-- Ou para encontrar um usuário específico por email:
-- SELECT id, email, created_at FROM auth.users WHERE email = 'email@exemplo.com';

