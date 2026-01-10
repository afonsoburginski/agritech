import * as React from 'react';
import { useColor } from '@/hooks/useColor';

import { Text } from '@/components/ui/text';
import { View } from '@/components/ui/view';
import {
  Switch as RNSwitch,
  SwitchProps as RNSwitchProps,
  TextStyle,
} from 'react-native';

interface SwitchProps extends RNSwitchProps {
  label?: string;
  error?: string;
  labelStyle?: TextStyle;
}

export function Switch({ label, error, labelStyle, ...props }: SwitchProps) {
  const mutedColor = useColor({}, 'muted');
  const primary = useColor({}, 'primary');
  const danger = useColor({}, 'red');

  return (
    <View style={{ marginBottom: 8 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: 32, // Ensure consistent height
        }}
      >
        {label && (
          <Text
            variant='caption'
            numberOfLines={2} // Allow wrapping for longer labels
            ellipsizeMode='tail'
            style={[
              {
                color: error ? danger : primary,
                flex: 1, // Take available space
                marginRight: 12, // Add spacing between label and switch
              },
              labelStyle,
            ]}
            pointerEvents='none'
          >
            {label}
          </Text>
        )}

        <RNSwitch
          trackColor={{ false: mutedColor, true: '#C9A227' }}
          thumbColor={props.value ? '#FFFDF8' : '#f4f3f4'}
          ios_backgroundColor={mutedColor}
          {...props}
        />
      </View>

      {error && (
        <Text
          variant='caption'
          numberOfLines={2}
          ellipsizeMode='tail'
          style={[
            {
              fontSize: 12, // Slightly smaller for error text
              color: danger, // Always use danger color for errors
              marginTop: 4, // Add spacing above error text
            },
          ]}
          pointerEvents='none'
        >
          {error}
        </Text>
      )}
    </View>
  );
}
