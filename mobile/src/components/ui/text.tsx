import { useColor } from '@/hooks/useColor';
import { FONT_SIZE } from '@/theme/globals';
import React from 'react';
import {
  Text as RNText,
  type TextProps as RNTextProps,
  type TextStyle,
  type StyleProp,
} from 'react-native';

type TextVariant =
  | 'body'
  | 'title'
  | 'subtitle'
  | 'caption'
  | 'heading'
  | 'link';

export interface TextProps {
  variant?: TextVariant;
  lightColor?: string;
  darkColor?: string;
  children?: React.ReactNode;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  ellipsizeMode?: RNTextProps['ellipsizeMode'];
  onPress?: () => void;
  selectable?: boolean;
  testID?: string;
  accessibilityLabel?: string;
  ref?: React.Ref<RNText>;
}

export function Text({
  variant = 'body',
  lightColor,
  darkColor,
  style,
  children,
  ref,
  ...props
}: TextProps) {
  const textColor = useColor({ light: lightColor, dark: darkColor }, 'text');
  const mutedColor = useColor({}, 'textMuted');

  const getTextStyle = (): TextStyle => {
    const baseStyle: TextStyle = {
      color: textColor,
    };

    switch (variant) {
      case 'heading':
        return {
          ...baseStyle,
          fontSize: 28,
          fontWeight: '800',
        };
      case 'title':
        return {
          ...baseStyle,
          fontSize: 24,
          fontWeight: '700',
        };
      case 'subtitle':
        return {
          ...baseStyle,
          fontSize: 19,
          fontWeight: '600',
        };
      case 'caption':
        return {
          ...baseStyle,
          fontSize: FONT_SIZE,
          fontWeight: '400',
          color: mutedColor,
        };
      case 'link':
        return {
          ...baseStyle,
          fontSize: FONT_SIZE,
          fontWeight: '500',
          textDecorationLine: 'underline',
        };
      default: // 'body'
        return {
          ...baseStyle,
          fontSize: FONT_SIZE,
          fontWeight: '400',
        };
    }
  };

  return (
    <RNText ref={ref} style={[getTextStyle(), style]} {...props}>
      {children}
    </RNText>
  );
}
