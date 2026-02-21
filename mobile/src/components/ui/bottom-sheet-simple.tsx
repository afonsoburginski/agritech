/**
 * BottomSheet Simplificado - Compatível com Expo Go
 * Versão sem worklets para evitar erros de compatibilidade
 */

import { Text } from '@/components/ui/text';
import { View } from '@/components/ui/view';
import { useColor } from '@/hooks/useColor';
import { BORDER_RADIUS } from '@/theme/globals';
import React from 'react';
import {
  Dimensions,
  Modal,
  ScrollView,
  TouchableWithoutFeedback,
  ViewStyle,
  Animated,
} from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

type BottomSheetProps = {
  isVisible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  style?: ViewStyle;
};

export function BottomSheet({
  isVisible,
  onClose,
  children,
  title,
  style,
}: BottomSheetProps) {
  const cardColor = useColor({}, 'card');
  const textColor = useColor({}, 'text');
  const mutedColor = useColor({}, 'textMuted');
  const slideAnim = React.useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  React.useEffect(() => {
    if (isVisible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [isVisible, slideAnim]);

  const handleBackdropPress = () => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  };

  if (!isVisible) {
    return null;
  }

  return (
    <Modal
      visible={isVisible}
      transparent
      statusBarTranslucent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.8)' }}>
        <TouchableWithoutFeedback onPress={handleBackdropPress}>
          <View style={{ flex: 1 }} />
        </TouchableWithoutFeedback>

        <Animated.View
          style={[
            {
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: cardColor,
              borderTopLeftRadius: BORDER_RADIUS,
              borderTopRightRadius: BORDER_RADIUS,
              maxHeight: SCREEN_HEIGHT * 0.9,
            },
            {
              transform: [{ translateY: slideAnim }],
            },
            style,
          ]}
        >
          {/* Handle */}
          <TouchableWithoutFeedback onPress={handleBackdropPress}>
            <View
              style={{
                width: '100%',
                paddingVertical: 12,
                alignItems: 'center',
              }}
            >
              <View
                style={{
                  width: 64,
                  height: 6,
                  backgroundColor: mutedColor,
                  borderRadius: 999,
                }}
              />
            </View>
          </TouchableWithoutFeedback>

          {/* Title */}
          {title && (
            <View
              style={{
                marginHorizontal: 16,
                marginTop: 16,
                paddingBottom: 8,
              }}
            >
              <Text variant="title" style={{ textAlign: 'center', color: textColor }}>
                {title}
              </Text>
            </View>
          )}

          {/* Content */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

// Hook for managing bottom sheet state
export function useBottomSheet() {
  const [isVisible, setIsVisible] = React.useState(false);

  const open = React.useCallback(() => {
    setIsVisible(true);
  }, []);

  const close = React.useCallback(() => {
    setIsVisible(false);
  }, []);

  const toggle = React.useCallback(() => {
    setIsVisible((prev) => !prev);
  }, []);

  return {
    isVisible,
    open,
    close,
    toggle,
  };
}
