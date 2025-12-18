-- Criar bucket para fotos de inquilinos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tenant-photos',
  'tenant-photos',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Política para permitir upload de fotos apenas para o próprio usuário
CREATE POLICY "Users can upload tenant photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'tenant-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Política para permitir atualização de fotos apenas para o próprio usuário
CREATE POLICY "Users can update their tenant photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'tenant-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'tenant-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Política para permitir remoção de fotos apenas para o próprio usuário
CREATE POLICY "Users can delete their tenant photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'tenant-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Política para permitir leitura pública das fotos
CREATE POLICY "Public can view tenant photos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'tenant-photos');

