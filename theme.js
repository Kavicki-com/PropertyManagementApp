// Cores padrão
const defaultColors = {
  primary: '#4a86e8',
  primaryDark: '#3844a1',
  primarySoft: '#e3f2fd',
  background: '#f5f5f5',
  surface: '#ffffff',
  textPrimary: '#111827',
  textSecondary: '#6b7280',
  textMuted: '#666666',
  borderSubtle: '#dddddd',
  danger: '#c62828',
  dangerSoft: '#ffebee',
  income: '#4CAF50',
  expense: '#F44336',
};

// Cores de alto contraste
const highContrastColors = {
  primary: '#000000',
  primaryDark: '#000000',
  primarySoft: '#e0e0e0', // Light grey for background contrast
  background: '#ffffff',
  surface: '#ffffff', // Often safer to keep surface white in HC for clarity, or can be light grey if needed.
  textPrimary: '#000000',
  textSecondary: '#000000',
  textMuted: '#000000',
  borderSubtle: '#000000',
  danger: '#000000', // In strict HC, even semantic colors often become black/bold, but user asked for "primary... and typefaces". I'll stick to primary/text as requested.
  dangerSoft: '#fee2e2', // Keep soft backgrounds distinct or make them white with borders? I'll keep default soft for now to avoid total loss of semantic meaning unless asked.
  income: '#16a34a',
  expense: '#dc2626',
};

export const colors = defaultColors;

export const radii = {
  pill: 999,
  lg: 16,
  md: 12,
  sm: 8,
  xs: 4,
};

// Tipografia base (sem multiplicador)
const baseTypography = {
  // Títulos de tela principais
  screenTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  // Títulos de seção
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  // Labels de campos
  label: {
    fontSize: 14,
    fontWeight: '500',
  },
  // Texto padrão
  body: {
    fontSize: 14,
    fontWeight: '400',
  },
  // Texto em cards / valores
  bodyStrong: {
    fontSize: 16,
    fontWeight: '600',
  },
  // Botões
  button: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  // Pequenos detalhes / meta
  caption: {
    fontSize: 12,
    fontWeight: '400',
  },
};

// Tipografia padrão (compatibilidade retroativa)
export const typography = {
  screenTitle: {
    ...baseTypography.screenTitle,
    color: colors.textPrimary,
  },
  sectionTitle: {
    ...baseTypography.sectionTitle,
    color: colors.textPrimary,
  },
  label: {
    ...baseTypography.label,
    color: colors.textPrimary,
  },
  body: {
    ...baseTypography.body,
    color: colors.textSecondary,
  },
  bodyStrong: {
    ...baseTypography.bodyStrong,
    color: colors.textPrimary,
  },
  button: baseTypography.button,
  caption: {
    ...baseTypography.caption,
    color: colors.textMuted,
  },
};

/**
 * Gera tema dinâmico baseado nas configurações de acessibilidade
 * @param {Object} accessibilitySettings - { fontScale: number, highContrast: boolean }
 * @returns {Object} Tema com cores e tipografia ajustadas
 */
export function getTheme(accessibilitySettings = { fontScale: 1.0, highContrast: false }) {
  const { fontScale = 1.0, highContrast = false } = accessibilitySettings;

  // Seleciona paleta de cores
  const themeColors = highContrast ? highContrastColors : defaultColors;

  // Aplica multiplicador de fonte na tipografia
  const themeTypography = {
    screenTitle: {
      ...baseTypography.screenTitle,
      fontSize: Math.round(baseTypography.screenTitle.fontSize * fontScale),
      color: themeColors.textPrimary,
    },
    sectionTitle: {
      ...baseTypography.sectionTitle,
      fontSize: Math.round(baseTypography.sectionTitle.fontSize * fontScale),
      color: themeColors.textPrimary,
    },
    label: {
      ...baseTypography.label,
      fontSize: Math.round(baseTypography.label.fontSize * fontScale),
      color: themeColors.textPrimary,
    },
    body: {
      ...baseTypography.body,
      fontSize: Math.round(baseTypography.body.fontSize * fontScale),
      color: themeColors.textSecondary,
    },
    bodyStrong: {
      ...baseTypography.bodyStrong,
      fontSize: Math.round(baseTypography.bodyStrong.fontSize * fontScale),
      color: themeColors.textPrimary,
    },
    button: {
      ...baseTypography.button,
      fontSize: Math.round(baseTypography.button.fontSize * fontScale),
    },
    caption: {
      ...baseTypography.caption,
      fontSize: Math.round(baseTypography.caption.fontSize * fontScale),
      color: themeColors.textMuted,
    },
  };

  return {
    colors: themeColors,
    radii,
    typography: themeTypography,
    isHighContrast: highContrast,
    fontScale: fontScale,
  };
}



