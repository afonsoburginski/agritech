import React, { useEffect } from 'react';
import { View, ViewStyle, Dimensions, Text } from 'react-native';
import Svg, { Rect, Text as SvgText, G } from 'react-native-svg';
import { useColor } from '@/hooks/useColor';
import Constants from 'expo-constants';

const isExpoGo = Constants.executionEnvironment === 'storeClient';

let Animated: any = View;
let useSharedValue: any = null;
let useAnimatedStyle: any = null;
let withTiming: any = null;

if (!isExpoGo) {
  try {
    const reanimated = require('react-native-reanimated');
    if (reanimated && reanimated.default) {
      Animated = reanimated.default;
      useSharedValue = reanimated.useSharedValue;
      useAnimatedStyle = reanimated.useAnimatedStyle;
      withTiming = reanimated.withTiming;
    }
  } catch (error: any) {
    // Fallback
  }
}

export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

export interface ChartConfig {
  width?: number;
  height?: number;
  padding?: number;
  showGrid?: boolean;
  showLabels?: boolean;
  animated?: boolean;
  duration?: number;
}

interface BarChartProps {
  data: ChartDataPoint[];
  config?: ChartConfig;
  style?: ViewStyle;
}

export function BarChart({
  data,
  config = {},
  style,
}: BarChartProps) {
  const {
    width: configWidth,
    height = 200,
    padding = 20,
    showLabels = true,
    animated = true,
    duration = 800,
  } = config;

  const primaryColor = useColor({}, 'primary');
  const mutedColor = useColor({}, 'mutedForeground');
  const { width: screenWidth } = Dimensions.get('window');
  const chartWidth = configWidth || screenWidth - 48 - padding * 2;
  const innerWidth = chartWidth - padding * 2;
  const innerHeight = height - padding * 2;

  // Validação de dados
  if (!data || data.length === 0) {
    return (
      <View style={[{ width: chartWidth, height }, style]}>
        <Text style={{ color: mutedColor, textAlign: 'center', padding: 20 }}>
          Nenhum dado disponível
        </Text>
      </View>
    );
  }

  const validData = data.filter((d) => d && typeof d.value === 'number' && !isNaN(d.value) && isFinite(d.value));
  if (validData.length === 0) {
    return (
      <View style={[{ width: chartWidth, height }, style]}>
        <Text style={{ color: mutedColor, textAlign: 'center', padding: 20 }}>
          Nenhum dado válido
        </Text>
      </View>
    );
  }

  const maxValue = Math.max(...validData.map((d) => d.value), 0) || 1;
  const barWidth = innerWidth / validData.length - 10;
  const barSpacing = 10;
  
  // Tons de azul do claro ao médio
  const blueColors = ['#DBEAFE', '#BFDBFE', '#93C5FD', '#60A5FA', '#3B82F6', '#2563EB'];

  const animatedValues = validData.map(() => {
    if (isExpoGo || !useSharedValue) return { value: 1 };
    return { value: useSharedValue(0) };
  });

  useEffect(() => {
    if (animated && !isExpoGo && withTiming && animatedValues[0]?.value) {
      animatedValues.forEach((anim, index) => {
        if (anim.value) {
          anim.value = withTiming(1, { duration: duration + index * 50 });
        }
      });
    }
  }, []);

  return (
    <View style={[{ width: chartWidth, height }, style]}>
      <Svg width={chartWidth} height={height}>
        <G x={padding} y={padding}>
          {validData.map((point, index) => {
            const barHeight = (point.value / maxValue) * innerHeight;
            const x = index * (barWidth + barSpacing);
            const y = innerHeight - barHeight;
            // Usar cor personalizada ou tons de azul do claro ao médio
            const color = point.color || blueColors[Math.min(index, blueColors.length - 1)];
            const animValue = animatedValues[index]?.value || 1;
            const finalHeight = barHeight * (typeof animValue === 'number' ? animValue : animValue?.value || 1);

            return (
              <G key={index}>
                <Rect
                  x={x}
                  y={innerHeight - finalHeight}
                  width={barWidth}
                  height={finalHeight}
                  fill={color}
                  rx={4}
                  ry={4}
                />
                {showLabels && (
                  <>
                    <SvgText
                      x={x + barWidth / 2}
                      y={innerHeight + 15}
                      fontSize={12}
                      fill={mutedColor}
                      textAnchor="middle"
                    >
                      {point.label}
                    </SvgText>
                    <SvgText
                      x={x + barWidth / 2}
                      y={innerHeight - finalHeight - 5}
                      fontSize={11}
                      fill={color}
                      textAnchor="middle"
                      fontWeight="600"
                    >
                      {point.value}
                    </SvgText>
                  </>
                )}
              </G>
            );
          })}
        </G>
      </Svg>
    </View>
  );
}

