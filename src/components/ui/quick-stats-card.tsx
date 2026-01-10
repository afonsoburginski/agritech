import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { View } from '@/components/ui/view';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { useColor } from '@/hooks/useColor';
import { BORDER_RADIUS } from '@/theme/globals';
import { LucideProps } from 'lucide-react-native';

interface QuickStatsCardProps {
  icon: React.ComponentType<LucideProps>;
  value: number | string;
  label: string;
  color?: string;
  style?: ViewStyle;
}

export function QuickStatsCard({ 
  icon, 
  value, 
  label, 
  color,
  style 
}: QuickStatsCardProps) {
  const cardColor = useColor({}, 'card');
  const textColor = useColor({}, 'text');
  const mutedColor = useColor({}, 'textMuted');
  const primaryColor = useColor({}, 'primary');
  
  const accentColor = color || primaryColor;

  return (
    <View style={[styles.container, { backgroundColor: cardColor }, style]}>
      <View style={[styles.iconContainer, { backgroundColor: accentColor + '15' }]}>
        <Icon name={icon} size={20} color={accentColor} />
      </View>
      <Text style={[styles.value, { color: textColor }]}>
        {value}
      </Text>
      <Text style={[styles.label, { color: mutedColor }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: BORDER_RADIUS,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
    shadowColor: '#0e270a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  value: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 2,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
});
