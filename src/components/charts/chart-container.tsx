import React from 'react';
import { View, ViewStyle } from 'react-native';
import { Text } from '@/components/ui/text';
import { useColor } from '@/hooks/useColor';

interface ChartContainerProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  style?: ViewStyle;
}

export function ChartContainer({
  title,
  description,
  children,
  style,
}: ChartContainerProps) {
  const textColor = useColor({}, 'text');
  const mutedColor = useColor({}, 'textMuted');

  return (
    <View style={style}>
      {title && (
        <Text variant="subtitle" style={{ color: textColor, marginBottom: 8 }}>
          {title}
        </Text>
      )}
      {description && (
        <Text variant="caption" style={{ color: mutedColor, marginBottom: 16 }}>
          {description}
        </Text>
      )}
      {children}
    </View>
  );
}
