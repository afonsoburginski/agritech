import React from 'react';
import { StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { View } from '@/components/ui/view';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { useColor } from '@/hooks/useColor';
import { BORDER_RADIUS } from '@/theme/globals';
import { LucideProps } from 'lucide-react-native';

interface QuickActionButtonProps {
  icon: React.ComponentType<LucideProps>;
  label: string;
  onPress: () => void;
  color?: string;
  style?: ViewStyle;
}

export function QuickActionButton({ 
  icon, 
  label, 
  onPress,
  color,
  style 
}: QuickActionButtonProps) {
  const cardColor = useColor({}, 'card');
  const textColor = useColor({}, 'text');
  const primaryColor = useColor({}, 'primary');
  
  const accentColor = color || primaryColor;

  return (
    <TouchableOpacity 
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.container, { backgroundColor: cardColor }, style]}
    >
      <View style={[styles.iconContainer, { backgroundColor: accentColor }]}>
        <Icon name={icon} size={20} color="#FFFFFF" />
      </View>
      <Text style={[styles.label, { color: textColor }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: BORDER_RADIUS,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
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
  label: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
});
