/**
 * Tema BNA UI - Cores padrão conforme documentação
 * https://ui.ahmedbna.com/docs/theming
 * 
 * Paleta de cores Agritech disponível como cores extras (ver export palette abaixo)
 */

const lightColors = {
  // Base colors
  background: '#FFFFFF',
  foreground: '#000000',

  // Card colors
  card: '#F2F2F7',
  cardForeground: '#000000',

  // Popover colors
  popover: '#FFFFFF',
  popoverForeground: '#000000',

  // Primary colors
  primary: '#18181b',
  primaryForeground: '#FFFFFF',

  // Secondary colors
  secondary: '#F2F2F7',
  secondaryForeground: '#18181b',

  // Muted colors
  muted: '#78788033',
  mutedForeground: '#71717a',

  // Accent colors
  accent: '#F2F2F7',
  accentForeground: '#18181b',

  // Destructive colors
  destructive: '#ef4444',
  destructiveForeground: '#FFFFFF',

  // Border and input
  border: '#E0E0E0',
  input: '#e4e4e7',
  ring: '#18181b',

  // Text colors
  text: '#000000',
  textMuted: '#71717a',

  // Legacy support for existing components
  tint: '#18181b',
  icon: '#18181b',
  tabIconDefault: '#757575',
  tabIconSelected: '#18181b',

  // System colors - iOS system colors
  blue: '#007AFF',
  green: '#34C759',
  red: '#FF3B30',
  orange: '#FF9500',
  yellow: '#FFCC00',
  pink: '#FF2D92',
  purple: '#AF52DE',
  teal: '#5AC8FA',
  indigo: '#5856D6',
};

const darkColors = {
  // Base colors
  background: '#000000',
  foreground: '#FFFFFF',

  // Card colors
  card: '#1C1C1E',
  cardForeground: '#FFFFFF',

  // Popover colors
  popover: '#1C1C1E',
  popoverForeground: '#FFFFFF',

  // Primary colors
  primary: '#e4e4e7',
  primaryForeground: '#18181b',

  // Secondary colors
  secondary: '#1C1C1E',
  secondaryForeground: '#FFFFFF',

  // Muted colors
  muted: '#78788033',
  mutedForeground: '#a1a1aa',

  // Accent colors
  accent: '#1C1C1E',
  accentForeground: '#FFFFFF',

  // Destructive colors
  destructive: '#dc2626',
  destructiveForeground: '#FFFFFF',

  // Border and input - using alpha values for better blending
  border: '#38383a',
  input: 'rgba(255, 255, 255, 0.15)',
  ring: '#e4e4e7',

  // Text colors
  text: '#FFFFFF',
  textMuted: '#a1a1aa',

  // Legacy support for existing components
  tint: '#e4e4e7',
  icon: '#e4e4e7',
  tabIconDefault: '#B0B0B0',
  tabIconSelected: '#e4e4e7',

  // System colors - iOS system colors (adapted for dark mode)
  blue: '#0A84FF',
  green: '#30D158',
  red: '#FF453A',
  orange: '#FF9F0A',
  yellow: '#FFD60A',
  pink: '#FF375F',
  purple: '#BF5AF2',
  teal: '#64D2FF',
  indigo: '#5E5CE6',
};

export const Colors = {
  light: lightColors,
  dark: darkColors,
};

// Export individual color schemes for easier access
export { darkColors, lightColors };

// Utility type for color keys
export type ColorKeys = keyof typeof lightColors;

/**
 * Paleta de cores Agritech - cores adicionais para uso quando necessário
 * Baseada na tabela de cores oficial
 */
export const palette = {
  darkGreen: '#0e270a',
  oliveGreen: '#595412',
  gold: '#eab203',
  brown: '#a76e29',
  black: '#000000',
} as const;

