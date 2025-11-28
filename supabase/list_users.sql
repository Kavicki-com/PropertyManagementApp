-- Script para listar usuários e encontrar UUIDs
-- Execute este script no SQL Editor do Supabase

-- ============================================
-- Listar todos os usuários de autenticação
-- ============================================
SELECT 
    id,
    email,
    created_at,
    email_confirmed_at,
    last_sign_in_at
FROM auth.users 
ORDER BY created_at DESC;

-- ============================================
-- Listar usuários com seus perfis
-- ============================================
SELECT 
    u.id,
    u.email,
    u.created_at,
    p.full_name,
    p.phone
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
ORDER BY u.created_at DESC;

-- ============================================
-- Buscar usuário específico por email
-- ============================================
-- Substitua 'email@exemplo.com' pelo email que deseja encontrar
-- SELECT 
--     id,
--     email,
--     created_at
-- FROM auth.users 
-- WHERE email = 'email@exemplo.com';

-- ============================================
-- Contar usuários
-- ============================================
SELECT COUNT(*) as total_usuarios FROM auth.users;
SELECT COUNT(*) as total_profiles FROM public.profiles;

