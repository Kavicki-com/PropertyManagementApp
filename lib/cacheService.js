import AsyncStorage from '@react-native-async-storage/async-storage';

// TTL padrão: 30 segundos para dados dinâmicos
const DEFAULT_TTL = 30000;

// TTL para dados menos dinâmicos (dashboard)
const LONG_TTL = 60000;

/**
 * Salva dados no cache com TTL (Time To Live)
 * @param {string} key - Chave do cache
 * @param {any} data - Dados para cachear
 * @param {number} ttl - Tempo de vida em milissegundos (padrão: 30s)
 */
export const setCache = async (key, data, ttl = DEFAULT_TTL) => {
  try {
    const cacheData = {
      data,
      timestamp: Date.now(),
      ttl,
    };
    await AsyncStorage.setItem(key, JSON.stringify(cacheData));
  } catch (error) {
    console.error('Erro ao salvar no cache:', error);
  }
};

/**
 * Recupera dados do cache se ainda válidos
 * @param {string} key - Chave do cache
 * @returns {any|null} - Dados cacheados ou null se expirado/inexistente
 */
export const getCache = async (key) => {
  try {
    const cached = await AsyncStorage.getItem(key);
    if (!cached) return null;

    const { data, timestamp, ttl } = JSON.parse(cached);
    const age = Date.now() - timestamp;

    if (age > ttl) {
      // Cache expirado, remover
      await AsyncStorage.removeItem(key);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Erro ao ler do cache:', error);
    return null;
  }
};

/**
 * Remove um item específico do cache
 * @param {string} key - Chave do cache
 */
export const removeCache = async (key) => {
  try {
    await AsyncStorage.removeItem(key);
  } catch (error) {
    console.error('Erro ao remover do cache:', error);
  }
};

/**
 * Limpa todos os itens de cache relacionados à aplicação
 */
export const clearAllCache = async () => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter((key) => key.startsWith('cache_'));
    await AsyncStorage.multiRemove(cacheKeys);
  } catch (error) {
    console.error('Erro ao limpar cache:', error);
  }
};

/**
 * Prefixos para diferentes tipos de cache
 */
export const CACHE_KEYS = {
  PROPERTIES: 'cache_properties',
  TENANTS: 'cache_tenants',
  DASHBOARD: 'cache_dashboard',
  PROPERTY_DETAILS: (id) => `cache_property_${id}`,
  TENANT_DETAILS: (id) => `cache_tenant_${id}`,
  FINANCES: 'cache_finances',
};

// Exportar TTLs para uso em outros lugares
export const CACHE_TTL = {
  DEFAULT: DEFAULT_TTL,
  LONG: LONG_TTL,
  SHORT: 10000, // 10 segundos para dados muito dinâmicos
};