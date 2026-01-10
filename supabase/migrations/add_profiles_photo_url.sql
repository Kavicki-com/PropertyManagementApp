-- Adicionar campo photo_url na tabela profiles para armazenar URL da foto do usuário
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Comentário explicativo
COMMENT ON COLUMN profiles.photo_url IS 'URL da foto do perfil do usuário armazenada no Supabase Storage';
