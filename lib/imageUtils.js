import { Buffer } from 'buffer';

let ImageManipulator = null;
try {
  ImageManipulator = require('expo-image-manipulator');
} catch (error) {
  console.warn('expo-image-manipulator não está instalado. Algumas otimizações podem não funcionar.');
}

/**
 * Otimiza uma imagem antes do upload
 * - Redimensiona se maior que maxWidth
 * - Comprime para qualidade especificada
 * @param {string} uri - URI da imagem
 * @param {object} options - Opções de otimização
 * @returns {Promise<{uri: string, base64: string}>} - URI e base64 otimizados
 */
export const optimizeImage = async (uri, options = {}) => {
  if (!ImageManipulator) {
    // Se ImageManipulator não estiver disponível, retornar URI original
    console.warn('ImageManipulator não disponível. Retornando imagem original.');
    return { uri, base64: null };
  }

  const {
    maxWidth = 1200,
    compress = 0.5,
    format = ImageManipulator?.SaveFormat?.JPEG || 'jpeg',
  } = options;

  try {
    const manipulated = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: maxWidth } }], // Redimensiona mantendo aspect ratio
      {
        compress,
        format,
      }
    );

    return {
      uri: manipulated.uri,
      base64: manipulated.base64 || null,
    };
  } catch (error) {
    console.error('Erro ao otimizar imagem:', error);
    // Em caso de erro, retornar URI original
    return { uri, base64: null };
  }
};

/**
 * Converte base64 para ArrayBuffer para upload no Supabase Storage
 * @param {string} base64 - String base64
 * @returns {ArrayBuffer} - ArrayBuffer para upload
 */
export const base64ToArrayBuffer = (base64) => {
  try {
    const binaryString = Buffer.from(base64, 'base64').toString('binary');
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  } catch (error) {
    console.error('Erro ao converter base64 para ArrayBuffer:', error);
    throw error;
  }
};

/**
 * Upload otimizado de múltiplas imagens em paralelo
 * @param {Array<{uri: string, base64?: string}>} images - Array de imagens
 * @param {string} bucketName - Nome do bucket no Supabase
 * @param {string} folderPath - Caminho da pasta (ex: 'user_id/property_id')
 * @param {Function} uploadFn - Função de upload (recebe fileName e ArrayBuffer)
 * @returns {Promise<Array<string>>} - Array de URLs públicas
 */
export const uploadImagesInParallel = async (
  images,
  bucketName,
  folderPath,
  uploadFn
) => {
  try {
    // Otimizar todas as imagens primeiro (em paralelo)
    const optimizedImages = await Promise.all(
      images.map((img) => {
        if (img.base64) {
          // Já tem base64, não precisa otimizar novamente
          return Promise.resolve({ uri: img.uri, base64: img.base64 });
        }
        return optimizeImage(img.uri);
      })
    );

    // Preparar uploads
    const uploadPromises = optimizedImages.map((img, index) => {
      const fileName = `${folderPath}/${Date.now()}_${index}.jpg`;
      const arrayBuffer = img.base64
        ? base64ToArrayBuffer(img.base64)
        : null;

      return uploadFn(fileName, arrayBuffer || img.uri);
    });

    // Executar todos os uploads em paralelo
    const results = await Promise.allSettled(uploadPromises);

    // Filtrar apenas sucessos e retornar URLs
    return results
      .filter((result) => result.status === 'fulfilled')
      .map((result) => result.value);
  } catch (error) {
    console.error('Erro ao fazer upload de imagens:', error);
    throw error;
  }
};

/**
 * Configurações padrão para ImagePicker
 */
export const IMAGE_PICKER_OPTIONS = {
  quality: 0.5, // Reduzido de 0.7 para melhor performance
  allowsEditing: false,
  base64: true,
};

/**
 * Configurações para câmera
 */
export const CAMERA_OPTIONS = {
  quality: 0.5,
  allowsEditing: false,
  base64: true,
};