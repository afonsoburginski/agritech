import { Text } from '@/components/ui/text';
import { useColor } from '@/hooks/useColor';
import { BORDER_RADIUS, CORNERS, FONT_SIZE } from '@/theme/globals';
import { Loader2 } from 'lucide-react-native';
import React, { useEffect, useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View, ViewStyle } from 'react-native';
import Constants from 'expo-constants';

// Verificar se estamos no Expo Go (não suporta reanimated)
const isExpoGo = Constants.executionEnvironment === 'storeClient';

// Importar reanimated apenas se não estiver no Expo Go
let Animated: any = View;
let useAnimatedStyle: any = null;
let useSharedValue: any = null;
let withDelay: any = null;
let withRepeat: any = null;
let withSequence: any = null;
let withTiming: any = null;
let Easing: any = null;

if (!isExpoGo) {
  try {
    const reanimated = require('react-native-reanimated');
    Animated = reanimated.default || View;
    useAnimatedStyle = reanimated.useAnimatedStyle;
    useSharedValue = reanimated.useSharedValue;
    withDelay = reanimated.withDelay;
    withRepeat = reanimated.withRepeat;
    withSequence = reanimated.withSequence;
    withTiming = reanimated.withTiming;
    Easing = reanimated.Easing;
  } catch (error) {
    // Reanimated não disponível - usar fallbacks
  }
}

type SharedValue<T> = { value: T };

// Types
type SpinnerSize = 'default' | 'sm' | 'lg' | 'icon';
export type SpinnerVariant = 'default' | 'circle' | 'dots' | 'pulse' | 'bars';

interface SpinnerProps {
  size?: SpinnerSize;
  variant?: SpinnerVariant;
  label?: string;
  showLabel?: boolean;
  style?: ViewStyle;
  color?: string;
  thickness?: number; // Note: thickness is not used in the original component logic
  speed?: 'slow' | 'normal' | 'fast';
}

interface LoadingOverlayProps extends SpinnerProps {
  visible: boolean;
  backdrop?: boolean;
  backdropColor?: string;
  backdropOpacity?: number;
  onRequestClose?: () => void;
}

interface SpinnerConfig {
  size: number;
  iconSize: number;
  fontSize: number;
  gap: number;
  thickness: number;
}

// Configuration
const sizeConfig: Record<SpinnerSize, SpinnerConfig> = {
  sm: { size: 16, iconSize: 16, fontSize: 12, gap: 6, thickness: 2 },
  default: {
    size: 24,
    iconSize: 24,
    fontSize: FONT_SIZE,
    gap: 8,
    thickness: 2,
  },
  lg: { size: 32, iconSize: 32, fontSize: 16, gap: 10, thickness: 3 },
  icon: { size: 24, iconSize: 24, fontSize: FONT_SIZE, gap: 8, thickness: 2 },
};

const speedConfig = {
  slow: 1500,
  normal: 1000,
  fast: 500,
};

// --- Helper Animated Components for Dots and Bars ---

interface AnimatedShapeProps {
  anim: SharedValue<number>;
  color: string;
  size: number;
  style: ViewStyle;
}

const AnimatedDot = React.memo(
  ({ anim, color, size, style }: AnimatedShapeProps) => {
    const animatedStyle = useAnimatedStyle
      ? useAnimatedStyle(() => ({
          opacity: anim.value,
        }))
      : { opacity: anim.value };
    return (
      <Animated
        style={[
          style,
          { width: size, height: size, backgroundColor: color },
          animatedStyle,
        ]}
      />
    );
  }
);

const AnimatedBar = React.memo(
  ({ anim, color, size, style }: AnimatedShapeProps) => {
    const animatedStyle = useAnimatedStyle
      ? useAnimatedStyle(() => ({
          opacity: anim.value,
        }))
      : { opacity: anim.value };
    return (
      <Animated
        style={[
          style,
          { width: size / 6, height: size, backgroundColor: color },
          animatedStyle,
        ]}
      />
    );
  }
);

// Main Spinner Component
export function Spinner({
  size = 'default',
  variant = 'default',
  label,
  showLabel = false,
  style,
  color,
  speed = 'normal',
}: SpinnerProps) {
  // Reanimated shared values (ou fallback simples)
  const rotate = useSharedValue ? useSharedValue(0) : { value: 0 };
  const pulse = useSharedValue ? useSharedValue(1) : { value: 1 };

  // --- FIX: Call hooks at the top level ---
  // 1. Call useSharedValue at the top level for each dot/bar
  const dotAnim1 = useSharedValue ? useSharedValue(0.3) : { value: 0.3 };
  const dotAnim2 = useSharedValue ? useSharedValue(0.3) : { value: 0.3 };
  const dotAnim3 = useSharedValue ? useSharedValue(0.3) : { value: 0.3 };

  const barAnim1 = useSharedValue ? useSharedValue(0.3) : { value: 0.3 };
  const barAnim2 = useSharedValue ? useSharedValue(0.3) : { value: 0.3 };
  const barAnim3 = useSharedValue ? useSharedValue(0.3) : { value: 0.3 };
  const barAnim4 = useSharedValue ? useSharedValue(0.3) : { value: 0.3 };

  // 2. Use useMemo to create a stable array reference from the values
  const dotsAnims = useMemo(
    () => [dotAnim1, dotAnim2, dotAnim3],
    [dotAnim1, dotAnim2, dotAnim3]
  );
  const barsAnims = useMemo(
    () => [barAnim1, barAnim2, barAnim3, barAnim4],
    [barAnim1, barAnim2, barAnim3, barAnim4]
  );
  // --- END FIX ---

  // Theme colors
  const primaryColor = useColor('text');
  const textColor = useColor('text');

  const config = sizeConfig[size];
  const spinnerColor = color || primaryColor;
  const animationDuration = speedConfig[speed];

  // Rotation animation (apenas se reanimated disponível)
  useEffect(() => {
    if (!withRepeat || !withTiming || !Easing) return;
    if (variant === 'circle') {
      rotate.value = withRepeat(
        withTiming(360, { duration: animationDuration, easing: Easing.linear }),
        -1
      );
    } else {
      rotate.value = 0; // Reset
    }
  }, [rotate, variant, animationDuration]);

  // Pulse animation (apenas se reanimated disponível)
  useEffect(() => {
    if (!withRepeat || !withSequence || !withTiming) return;
    if (variant === 'pulse') {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.3, { duration: animationDuration / 2 }),
          withTiming(1, { duration: animationDuration / 2 })
        ),
        -1,
        true
      );
    } else {
      pulse.value = 1; // Reset
    }
  }, [pulse, variant, animationDuration]);

  // Dots animation (apenas se reanimated disponível)
  useEffect(() => {
    if (!withRepeat || !withSequence || !withDelay || !withTiming) return;
    if (variant === 'dots') {
      dotsAnims.forEach((anim, index) => {
        anim.value = withRepeat(
          withSequence(
            withDelay(
              index * (animationDuration / 6),
              withTiming(1, { duration: animationDuration / 3 })
            ),
            withTiming(0.3, { duration: animationDuration / 3 })
          ),
          -1
        );
      });
    } else {
      dotsAnims.forEach((anim) => (anim.value = 0.3)); // Reset
    }
  }, [dotsAnims, variant, animationDuration]);

  // Bars animation (apenas se reanimated disponível)
  useEffect(() => {
    if (!withRepeat || !withSequence || !withDelay || !withTiming) return;
    if (variant === 'bars') {
      barsAnims.forEach((anim, index) => {
        anim.value = withRepeat(
          withSequence(
            withDelay(
              index * (animationDuration / 8),
              withTiming(1, { duration: animationDuration / 4 })
            ),
            withTiming(0.3, { duration: animationDuration / 4 })
          ),
          -1
        );
      });
    } else {
      barsAnims.forEach((anim) => (anim.value = 0.3)); // Reset
    }
  }, [barsAnims, variant, animationDuration]);

  // Animated styles (apenas se reanimated disponível)
  const animatedCircleStyle = useAnimatedStyle
    ? useAnimatedStyle(() => ({
        transform: [{ rotate: `${rotate.value}deg` }],
      }))
    : { transform: [{ rotate: '0deg' }] };

  const animatedPulseStyle = useAnimatedStyle
    ? useAnimatedStyle(() => ({
        transform: [{ scale: pulse.value }],
      }))
    : { transform: [{ scale: 1 }] };

  const renderSpinner = () => {
    switch (variant) {
      case 'default':
        return (
          <ActivityIndicator
            size={config.size}
            color={spinnerColor}
            style={styles.spinner}
          />
        );

      case 'circle':
        return (
          <Animated
            style={[
              styles.customSpinner,
              { width: config.size, height: config.size },
              animatedCircleStyle,
            ]}
          >
            <Loader2 size={config.iconSize} color={spinnerColor} />
          </Animated>
        );

      case 'pulse':
        return (
          <Animated
            style={[
              styles.pulseSpinner,
              {
                width: config.size,
                height: config.size,
                backgroundColor: spinnerColor,
              },
              animatedPulseStyle,
            ]}
          />
        );

      case 'dots':
        return (
          <View style={[styles.dotsContainer, { gap: config.size / 4 }]}>
            {dotsAnims.map((anim, index) => (
              <AnimatedDot
                key={index}
                anim={anim}
                color={spinnerColor}
                size={config.size / 3}
                style={styles.dot}
              />
            ))}
          </View>
        );

      case 'bars':
        return (
          <View style={[styles.barsContainer, { gap: config.size / 6 }]}>
            {barsAnims.map((anim, index) => (
              <AnimatedBar
                key={index}
                anim={anim}
                color={spinnerColor}
                size={config.size}
                style={styles.bar}
              />
            ))}
          </View>
        );

      default:
        return null;
    }
  };

  const containerStyle: ViewStyle = {
    alignItems: 'center',
    justifyContent: 'center',
    gap: config.gap,
  };

  return (
    <View style={[containerStyle, style]}>
      {renderSpinner()}
      {(showLabel || label) && (
        <Text
          style={[
            styles.label,
            {
              color: textColor,
              fontSize: config.fontSize,
            },
          ]}
        >
          {label || 'Loading...'}
        </Text>
      )}
    </View>
  );
}

// Loading Overlay Component
export function LoadingOverlay({
  visible,
  backdrop = true,
  backdropColor,
  backdropOpacity = 0.5,
  ...spinnerProps
}: LoadingOverlayProps) {
  const opacity = useSharedValue ? useSharedValue(0) : { value: visible ? 1 : 0 };
  const backgroundColor = useColor('background');
  const cardColor = useColor('card');

  useEffect(() => {
    if (withTiming) {
      opacity.value = withTiming(visible ? 1 : 0, {
        duration: 200,
      });
    } else {
      opacity.value = visible ? 1 : 0;
    }
  }, [visible, opacity]);

  const animatedOverlayStyle = useAnimatedStyle
    ? useAnimatedStyle(() => ({
        opacity: opacity.value,
        display: opacity.value === 0 ? 'none' : 'flex',
      }))
    : { opacity: opacity.value, display: opacity.value === 0 ? 'none' : 'flex' };

  const defaultBackdropColor =
    backdropColor ||
    `${backgroundColor}${Math.round(backdropOpacity * 255)
      .toString(16)
      .padStart(2, '0')}`;

  return (
    <Animated
      style={[
        styles.overlay,
        { backgroundColor: backdrop ? defaultBackdropColor : 'transparent' },
        animatedOverlayStyle,
      ]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <View style={[styles.overlayContent, { backgroundColor: cardColor }]}>
        <Spinner {...spinnerProps} />
      </View>
    </Animated>
  );
}

// Inline Loader Component (for buttons, etc.)
export function InlineLoader({
  size = 'sm',
  variant = 'default',
  color,
}: Omit<SpinnerProps, 'label' | 'showLabel'>) {
  return (
    <Spinner
      size={size}
      variant={variant}
      color={color}
      style={styles.inlineLoader}
    />
  );
}

// Button Spinner Component - optimized for button usage
export function ButtonSpinner({
  size = 'sm',
  variant = 'default',
  color,
}: Omit<SpinnerProps, 'label' | 'showLabel'>) {
  const primaryForegroundColor = useColor('primaryForeground');

  return (
    <Spinner
      size={size}
      variant={variant}
      color={color || primaryForegroundColor}
      style={styles.buttonSpinner}
    />
  );
}

const styles = StyleSheet.create({
  spinner: {
    alignSelf: 'center',
  },
  customSpinner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseSpinner: {
    borderRadius: 999,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    borderRadius: 999,
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: {
    borderRadius: CORNERS,
  },
  label: {
    textAlign: 'center',
    fontWeight: '500',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  overlayContent: {
    padding: 60,
    borderRadius: BORDER_RADIUS,
  },
  inlineLoader: {
    minHeight: 0,
    minWidth: 0,
  },
  buttonSpinner: {
    minHeight: 0,
    minWidth: 0,
  },
});
