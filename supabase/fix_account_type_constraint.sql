-- Script para configurar a constraint account_type na tabela profiles
-- Execute este script no SQL Editor do Supabase

-- Primeiro, remove a constraint existente se houver
ALTER TABLE profiles 
DROP CONSTRAINT IF EXISTS profiles_account_type_check;

-- Agora cria a constraint com os valores permitidos
-- Escolha uma das opções abaixo:

-- OPÇÃO 1: Valores em inglês (recomendado)
ALTER TABLE profiles
ADD CONSTRAINT profiles_account_type_check 
CHECK (account_type IS NULL OR account_type IN ('individual', 'company', 'advisory'));

-- OPÇÃO 2: Valores em português com underscore
-- ALTER TABLE profiles
-- ADD CONSTRAINT profiles_account_type_check 
-- CHECK (account_type IS NULL OR account_type IN ('pessoa_fisica', 'empresa', 'assessoria'));

-- OPÇÃO 3: Valores em português sem underscore
-- ALTER TABLE profiles
-- ADD CONSTRAINT profiles_account_type_check 
-- CHECK (account_type IS NULL OR account_type IN ('pessoafisica', 'empresa', 'assessoria'));

-- NOTA: A constraint permite NULL, então o campo é opcional.
-- Se você quiser tornar o campo obrigatório, remova "account_type IS NULL OR" da constraint.

