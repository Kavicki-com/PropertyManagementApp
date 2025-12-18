// lib/tenantDocumentsService.js
// Serviço para gerenciar documentos de inquilinos

import { supabase } from './supabase';
import { Buffer } from 'buffer';

// Função auxiliar para decodificar base64
const decode = (base64) => {
  const binaryString = Buffer.from(base64, 'base64').toString('binary');
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

// Tipos de documentos permitidos
export const DOCUMENT_TYPES = [
  { key: 'cpf', label: 'CPF' },
  { key: 'rg', label: 'RG' },
  { key: 'comprovante_renda', label: 'Comprovante de Renda' },
  { key: 'comprovante_residencia', label: 'Comprovante de Residência' },
  { key: 'contrato', label: 'Contrato' },
  { key: 'outros', label: 'Outros' },
];

// Tipos MIME permitidos
const ALLOWED_MIME_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'application/pdf': ['.pdf'],
};

// Tamanho máximo: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB em bytes

/**
 * Valida o tipo de arquivo
 */
const validateFileType = (mimeType, fileName) => {
  const allowedTypes = Object.keys(ALLOWED_MIME_TYPES);
  if (!allowedTypes.includes(mimeType)) {
    return { valid: false, error: 'Tipo de arquivo não permitido. Use PDF, JPG ou PNG.' };
  }
  return { valid: true };
};

/**
 * Valida o tamanho do arquivo
 */
const validateFileSize = (fileSize) => {
  if (fileSize > MAX_FILE_SIZE) {
    return { valid: false, error: `Arquivo muito grande. Tamanho máximo: 10MB.` };
  }
  return { valid: true };
};

/**
 * Obtém a extensão do arquivo baseado no MIME type
 */
const getFileExtension = (mimeType) => {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'application/pdf') return 'pdf';
  return 'bin';
};

/**
 * Busca todos os documentos de um inquilino
 */
export const fetchTenantDocuments = async (tenantId) => {
  try {
    const { data, error } = await supabase
      .from('tenant_documents')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('uploaded_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar documentos:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (err) {
    console.error('Erro inesperado ao buscar documentos:', err);
    return { data: null, error: err };
  }
};

/**
 * Faz upload de um documento para o Supabase Storage
 */
export const uploadTenantDocument = async (tenantId, documentType, fileData, customName = null) => {
  try {
    // Obter usuário atual
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { data: null, error: { message: 'Usuário não autenticado.' } };
    }

    // Validar tipo de arquivo
    const typeValidation = validateFileType(fileData.mimeType, fileData.fileName);
    if (!typeValidation.valid) {
      return { data: null, error: { message: typeValidation.error } };
    }

    // Validar tamanho do arquivo
    const sizeValidation = validateFileSize(fileData.fileSize);
    if (!sizeValidation.valid) {
      return { data: null, error: { message: sizeValidation.error } };
    }

    // Gerar nome do arquivo no storage
    const timestamp = Date.now();
    const extension = getFileExtension(fileData.mimeType);
    const fileName = `${user.id}/${tenantId}/${documentType}_${timestamp}.${extension}`;
    const bucketName = 'tenant-documents';

    // Fazer upload do arquivo
    let uploadData;
    if (fileData.base64) {
      // Arquivo em base64 (imagens do ImagePicker)
      uploadData = decode(fileData.base64);
    } else if (fileData.uri) {
      // Para PDFs ou outros arquivos, pode ser necessário usar fetch
      // Nota: expo-image-picker suporta apenas imagens. Para PDFs, seria necessário
      // usar uma biblioteca adicional como expo-document-picker
      // Por enquanto, vamos suportar apenas base64 (imagens)
      return { data: null, error: { message: 'Formato de arquivo não suportado. Use imagens (JPG/PNG).' } };
    } else {
      return { data: null, error: { message: 'Dados do arquivo inválidos.' } };
    }

    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(fileName, uploadData, { contentType: fileData.mimeType });

    if (uploadError) {
      console.error('Erro no upload:', uploadError);
      return { data: null, error: uploadError };
    }

    // Obter URL pública do arquivo
    const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(fileName);
    if (!urlData || !urlData.publicUrl) {
      return { data: null, error: { message: 'Erro ao obter URL do arquivo.' } };
    }

    // Inserir registro na tabela tenant_documents
    const { data: documentData, error: insertError } = await supabase
      .from('tenant_documents')
      .insert({
        tenant_id: tenantId,
        document_type: documentType,
        custom_name: customName,
        file_name: fileData.fileName || `documento.${extension}`,
        file_url: urlData.publicUrl,
        file_size: fileData.fileSize,
        mime_type: fileData.mimeType,
        user_id: user.id,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Erro ao inserir documento:', insertError);
      // Tentar remover o arquivo do storage em caso de erro
      await supabase.storage.from(bucketName).remove([fileName]);
      return { data: null, error: insertError };
    }

    return { data: documentData, error: null };
  } catch (err) {
    console.error('Erro inesperado no upload:', err);
    return { data: null, error: err };
  }
};

/**
 * Deleta um documento
 */
export const deleteTenantDocument = async (documentId) => {
  try {
    // Primeiro, buscar o documento para obter o caminho do arquivo
    const { data: document, error: fetchError } = await supabase
      .from('tenant_documents')
      .select('file_url')
      .eq('id', documentId)
      .single();

    if (fetchError || !document) {
      return { error: fetchError || { message: 'Documento não encontrado.' } };
    }

    // Extrair o caminho do arquivo da URL
    // A URL do Supabase Storage tem o formato: https://[project].supabase.co/storage/v1/object/public/[bucket]/[path]
    const urlParts = document.file_url.split('/');
    const bucketIndex = urlParts.indexOf('public');
    if (bucketIndex === -1 || bucketIndex === urlParts.length - 1) {
      return { error: { message: 'URL do arquivo inválida.' } };
    }
    const filePath = urlParts.slice(bucketIndex + 2).join('/'); // Pula 'public' e o nome do bucket

    // Deletar do storage
    const bucketName = 'tenant-documents';
    const { error: storageError } = await supabase.storage
      .from(bucketName)
      .remove([filePath]);

    if (storageError) {
      console.error('Erro ao deletar arquivo do storage:', storageError);
      // Continua mesmo se houver erro no storage, para deletar o registro
    }

    // Deletar registro da tabela
    const { error: deleteError } = await supabase
      .from('tenant_documents')
      .delete()
      .eq('id', documentId);

    if (deleteError) {
      return { error: deleteError };
    }

    return { error: null };
  } catch (err) {
    console.error('Erro inesperado ao deletar documento:', err);
    return { error: err };
  }
};

/**
 * Obtém a URL pública de um documento
 */
export const getDocumentUrl = (document) => {
  return document?.file_url || null;
};

