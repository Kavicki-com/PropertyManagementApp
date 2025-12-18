-- Adicionar campo photo_url na tabela tenants para armazenar URL da foto do inquilino
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Comentário explicativo
COMMENT ON COLUMN tenants.photo_url IS 'URL da foto do inquilino armazenada no Supabase Storage';

