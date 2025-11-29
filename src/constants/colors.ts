/**
 * Paleta de cores Agritech
 * Baseada na tabela de cores oficial:
 * - Dark Green: #0e270a
 * - Olive Green/Brown: #595412
 * - Bright Yellow/Gold: #eab203
 * - Medium Brown/Orange: #a76e29
 * - Black: #000000
 */

// Cores da paleta oficial
export const palette = {
  darkGreen: '#0e270a',
  oliveGreen: '#595412',
  gold: '#eab203',
  brown: '#a76e29',
  black: '#000000',
};

// Cores do tema Agritech compatíveis com light/dark mode
const themeColors = {
  light: {
    // Cores principais da paleta
    primary: palette.darkGreen,        // Verde escuro - cor principal
    secondary: palette.oliveGreen,    // Verde oliva - cor secundária
    accent: palette.gold,              // Dourado - cor de destaque
    tertiary: palette.brown,           // Marrom - cor terciária
    
    // Cores de interface
    background: '#F8F8F8',            // Fundo claro
    surface: '#FFFFFF',               // Superfície (cards, etc)
    text: '#0e270a',                  // Texto principal (dark green)
    textSecondary: '#595412',         // Texto secundário (olive green)
    textLight: '#757575',             // Texto claro
    border: '#E0E0E0',                // Bordas
    
    // Cores semânticas
    success: '#0e270a',               // Sucesso (dark green)
    error: '#D32F2F',                 // Erro (vermelho padrão)
    warning: palette.brown,            // Aviso (brown)
    info: palette.oliveGreen,         // Informação (olive green)
    
    // Cores especiais
    highlight: palette.gold,          // Destaque (gold)
    shadow: 'rgba(14, 39, 10, 0.1)',  // Sombra com dark green
  },
  dark: {
    // Cores principais da paleta (ajustadas para dark mode)
    primary: '#1a4a14',                // Dark green mais claro
    secondary: '#6b6a2a',             // Olive green mais claro
    accent: palette.gold,              // Dourado mantido
    tertiary: '#c88a4a',               // Brown mais claro
    
    // Cores de interface
    background: '#0e270a',             // Fundo escuro (dark green)
    surface: '#1a3a1a',                // Superfície escura
    text: '#FFFFFF',                   // Texto claro
    textSecondary: '#B0B0B0',          // Texto secundário
    textLight: '#808080',             // Texto claro
    border: '#2a4a2a',                 // Bordas escuras
    
    // Cores semânticas
    success: '#4CAF50',               // Sucesso (verde claro)
    error: '#EF5350',                 // Erro (vermelho claro)
    warning: palette.gold,             // Aviso (gold)
    info: palette.gold,                // Informação (gold)
    
    // Cores especiais
    highlight: palette.gold,           // Destaque (gold)
    shadow: 'rgba(0, 0, 0, 0.3)',     // Sombra escura
  },
};

// Cores simples para uso direto (padrão: light)
export const Colors = themeColors.light;

// Helper para acessar cores baseado no tema atual
export const getAgroColors = (theme: 'light' | 'dark' = 'light') => themeColors[theme];

export const agroColors = themeColors;
