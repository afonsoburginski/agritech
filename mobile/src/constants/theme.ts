/**
 * Tema do Expo Router (compatibilidade)
 * Este arquivo mantém compatibilidade com componentes do template Expo
 * As cores principais estão em colors.ts
 */

import { Platform } from 'react-native';
import { getAgroColors, palette } from './colors';

const tintColorLight = palette.darkGreen; // Dark Green - cor principal
const tintColorDark = palette.gold;       // Gold - cor de destaque no dark mode

// Cores do tema Expo (usando paleta Fox Fieldcore)
export const Colors = {
  light: {
    text: '#1A1A1A',                  // Texto suave
    background: '#F7F5F0',            // Creme suave
    tint: tintColorLight,
    icon: palette.oliveGreen,
    tabIconDefault: '#8B8B8B',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#FFFFFF',
    background: palette.darkGreen,
    tint: tintColorDark,
    icon: palette.gold,
    tabIconDefault: '#B0B0B0',
    tabIconSelected: tintColorDark,
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
