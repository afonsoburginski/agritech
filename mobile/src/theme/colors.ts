/**
 * Tema BNA UI - Cores e estrutura compatíveis com a documentação
 * https://ui.ahmedbna.com/docs/installation
 * https://ui.ahmedbna.com/docs/theming
 *
 * Paleta Fox Fieldcore disponível como cores extras (palette) e ColorKeys para useColor().
 */

const lightColors = {
  // Base colors - Tom creme/bege suave inspirado na paleta Fox Fieldcore
  background: '#F7F5F0',        // Creme suave (warm off-white)
  foreground: '#1A1A1A',

  // Card colors - Tom mais quente
  card: '#FFFDF8',              // Branco quente
  cardForeground: '#1A1A1A',

  // Popover colors
  popover: '#FFFDF8',
  popoverForeground: '#1A1A1A',

  // Primary colors - Usando verde escuro da paleta
  primary: '#0e270a',           // Dark Green
  primaryForeground: '#FFFFFF',

  // Secondary colors
  secondary: '#F0EDE5',         // Bege claro
  secondaryForeground: '#0e270a',

  // Muted colors
  muted: '#E8E4DB',             // Bege médio
  mutedForeground: '#6B6B6B',

  // Accent colors - Dourado da paleta
  accent: '#eab203',            // Gold
  accentForeground: '#1A1A1A',

  // Destructive colors
  destructive: '#DC3545',
  destructiveForeground: '#FFFFFF',

  // Border and input - Bordas mais quentes
  border: '#E0DCD3',            // Borda bege
  input: '#F0EDE5',
  ring: '#0e270a',

  // Text colors
  text: '#1A1A1A',              // Quase preto (mais suave que #000)
  textMuted: '#6B6B6B',

  // Legacy support for existing components
  tint: '#0e270a',
  icon: '#595412',              // Olive Green
  tabIconDefault: '#8B8B8B',
  tabIconSelected: '#0e270a',

  // System colors - Tons mais suaves
  blue: '#3B7DD8',
  green: '#2D8A4E',
  red: '#D94452',
  orange: '#E08C2D',
  yellow: '#D4A617',
  pink: '#D94480',
  purple: '#9652C4',
  teal: '#4AADBD',
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
 * Paleta de cores Fox Fieldcore - cores adicionais para uso quando necessário
 * Baseada na tabela de cores oficial
 */
export const palette = {
  darkGreen: '#0e270a',
  oliveGreen: '#595412',
  gold: '#eab203',
  brown: '#a76e29',
  black: '#000000',
} as const;

