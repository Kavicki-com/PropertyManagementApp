// lib/useAccessibilityTheme.js
import { useState, useEffect } from 'react';
import { loadAccessibilitySettings, subscribe } from './accessibilityService';
import { getTheme } from '../theme';

/**
 * Hook para obter tema dinâmico baseado nas preferências de acessibilidade
 * @returns {Object} { theme, isLoading, refresh }
 */
export function useAccessibilityTheme() {
  const [theme, setTheme] = useState(getTheme());
  const [isLoading, setIsLoading] = useState(true);

  const loadTheme = async () => {
    try {
      setIsLoading(true);
      const settings = await loadAccessibilitySettings();
      const dynamicTheme = getTheme(settings);
      setTheme(dynamicTheme);
    } catch (error) {
      console.error('Erro ao carregar tema de acessibilidade:', error);
      // Fallback para tema padrão
      const defaultTheme = getTheme({ fontScale: 1.0, highContrast: false });
      setTheme(defaultTheme);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTheme();

    // Inscrever para atualizações em tempo real
    const unsubscribe = subscribe((newSettings) => {
      const newTheme = getTheme(newSettings);
      setTheme(newTheme);
    });

    return unsubscribe;
  }, []);

  return {
    theme,
    isLoading,
    refresh: loadTheme,
  };
}
