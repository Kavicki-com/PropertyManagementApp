-- Migration: Adicionar colunas de endereço estruturadas na tabela properties
-- Execute esta query no SQL Editor do Supabase

-- Adicionar novas colunas para endereço estruturado
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS cep VARCHAR(8),
ADD COLUMN IF NOT EXISTS street VARCHAR(255),
ADD COLUMN IF NOT EXISTS number VARCHAR(20),
ADD COLUMN IF NOT EXISTS neighborhood VARCHAR(100),
ADD COLUMN IF NOT EXISTS city VARCHAR(100),
ADD COLUMN IF NOT EXISTS state VARCHAR(2),
ADD COLUMN IF NOT EXISTS complement VARCHAR(255);

-- Criar índices para melhorar performance de buscas
CREATE INDEX IF NOT EXISTS idx_properties_cep ON properties(cep);
CREATE INDEX IF NOT EXISTS idx_properties_city ON properties(city);
CREATE INDEX IF NOT EXISTS idx_properties_state ON properties(state);
CREATE INDEX IF NOT EXISTS idx_properties_neighborhood ON properties(neighborhood);

-- Comentários nas colunas (documentação)
COMMENT ON COLUMN properties.cep IS 'CEP do imóvel (8 dígitos, sem formatação)';
COMMENT ON COLUMN properties.street IS 'Rua, Avenida ou Logradouro';
COMMENT ON COLUMN properties.number IS 'Número do endereço';
COMMENT ON COLUMN properties.neighborhood IS 'Bairro';
COMMENT ON COLUMN properties.city IS 'Cidade';
COMMENT ON COLUMN properties.state IS 'Estado (UF, 2 caracteres)';
COMMENT ON COLUMN properties.complement IS 'Complemento (Apartamento, Bloco, etc.)';



