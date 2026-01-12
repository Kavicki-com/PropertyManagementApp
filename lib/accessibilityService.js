// lib/accessibilityService.js
import AsyncStorage from '@react-native-async-storage/async-storage';

const ACCESSIBILITY_STORAGE_KEY = 'accessibility_settings';

// Valores padrão
const DEFAULT_SETTINGS = {
  fontScale: 1.0,
  highContrast: false,
};

/**
 * Carrega as preferências de acessibilidade do armazenamento
 */
export async function loadAccessibilitySettings() {
  try {
    const stored = await AsyncStorage.getItem(ACCESSIBILITY_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
      };
    }
    return DEFAULT_SETTINGS;
  } catch (error) {
    console.error('Erro ao carregar preferências de acessibilidade:', error);
    return DEFAULT_SETTINGS;
  }
}

const listeners = [];

/**
 * Inscreve um listener para mudanças nas configurações
 * @param {Function} callback 
 * @returns {Function} Função para remover a inscrição
 */
export function subscribe(callback) {
  listeners.push(callback);
  return () => {
    const index = listeners.indexOf(callback);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  };
}

const notifyListeners = (settings) => {
  listeners.forEach(listener => listener(settings));
};

/**
 * Salva as preferências de acessibilidade no armazenamento
 */
export async function saveAccessibilitySettings(settings) {
  try {
    await AsyncStorage.setItem(ACCESSIBILITY_STORAGE_KEY, JSON.stringify(settings));
    notifyListeners(settings);
    return true;
  } catch (error) {
    console.error('Erro ao salvar preferências de acessibilidade:', error);
    return false;
  }
}

/**
 * Atualiza uma preferência específica
 */
export async function updateAccessibilitySetting(key, value) {
  try {
    const current = await loadAccessibilitySettings();
    const updated = {
      ...current,
      [key]: value,
    };
    return await saveAccessibilitySettings(updated);
  } catch (error) {
    console.error('Erro ao atualizar preferência de acessibilidade:', error);
    return false;
  }
}

/**
 * Reseta as preferências para os valores padrão
 */
export async function resetAccessibilitySettings() {
  try {
    await AsyncStorage.removeItem(ACCESSIBILITY_STORAGE_KEY);
    return true;
  } catch (error) {
    console.error('Erro ao resetar preferências de acessibilidade:', error);
    return false;
  }
}
