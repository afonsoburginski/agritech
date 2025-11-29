import React, { useEffect } from 'react';
import { View, ViewStyle, Dimensions } from 'react-native';
import Svg, { Circle, Line, Polygon, Text as SvgText, G } from 'react-native-svg';
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

export interface RadarChartDataPoint {
  label: string;
  value: number;
}

export interface ChartConfig {
  width?: number;
  height?: number;
  showLabels?: boolean;
  animated?: boolean;
  duration?: number;
  maxValue?: number;
}

interface RadarChartProps {
  data: RadarChartDataPoint[];
  config?: ChartConfig;
  style?: ViewStyle;
}

export function RadarChart({
  data,
  config = {},
  style,
}: RadarChartProps) {
  const {
    width: configWidth,
    height = 200,
    showLabels = true,
    animated = true,
    duration = 1000,
    maxValue: configMaxValue,
  } = config;

  // Usar tons de azul do claro ao médio
  const primaryColor = '#60A5FA'; // Azul médio
  const mutedColor = useColor({}, 'mutedForeground');
  const { width: screenWidth } = Dimensions.get('window');
  const chartWidth = configWidth || Math.min(screenWidth - 48, height);
  const centerX = chartWidth / 2;
  const centerY = height / 2;
  const radius = Math.min(centerX, centerY) - 40;

  // Validação de dados
  if (!data || data.length === 0) {
    return null;
  }

  const validData = data.filter((d) => d && typeof d.value === 'number' && !isNaN(d.value) && isFinite(d.value));
  if (validData.length === 0) {
    return null;
  }

  const maxValue = configMaxValue || Math.max(...validData.map((d) => d.value), 100);
  const numPoints = validData.length;
  const angleStep = numPoints > 0 ? (2 * Math.PI) / numPoints : 0;

  const getPoint = (index: number, value: number) => {
    if (!isFinite(value) || isNaN(value) || maxValue === 0) {
      return { x: centerX, y: centerY };
    }
    const angle = index * angleStep - Math.PI / 2;
    const normalizedValue = Math.max(0, Math.min(1, value / maxValue));
    const r = radius * normalizedValue;
    const x = centerX + r * Math.cos(angle);
    const y = centerY + r * Math.sin(angle);
    return {
      x: isFinite(x) ? x : centerX,
      y: isFinite(y) ? y : centerY,
    };
  };

  const points = validData.map((point, index) => getPoint(index, point.value));
  const pathData = points
    .filter((p) => isFinite(p.x) && isFinite(p.y))
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ') + ' Z';

  const animatedOpacity = isExpoGo || !useSharedValue 
    ? { value: 1 } 
    : { value: useSharedValue(0) };

  useEffect(() => {
    if (animated && !isExpoGo && withTiming && animatedOpacity.value) {
      animatedOpacity.value = withTiming(1, { duration });
    }
  }, []);

  const opacity = typeof animatedOpacity.value === 'number' 
    ? animatedOpacity.value 
    : animatedOpacity.value?.value || 1;

  return (
    <View style={[{ width: chartWidth, height }, style]}>
      <Svg width={chartWidth} height={height}>
        {/* Grid circles */}
        {[0.2, 0.4, 0.6, 0.8, 1.0].map((scale) => (
          <Circle
            key={scale}
            cx={centerX}
            cy={centerY}
            r={radius * scale}
            fill="none"
            stroke={mutedColor}
            strokeWidth={1}
            opacity={0.2}
          />
        ))}

        {/* Grid lines */}
        {validData.map((_, index) => {
          const angle = index * angleStep - Math.PI / 2;
          const x = centerX + radius * Math.cos(angle);
          const y = centerY + radius * Math.sin(angle);
          if (!isFinite(x) || !isFinite(y)) return null;
          return (
            <Line
              key={index}
              x1={centerX}
              y1={centerY}
              x2={x}
              y2={y}
              stroke={mutedColor}
              strokeWidth={1}
              opacity={0.2}
            />
          );
        })}

        {/* Data area */}
        {points.length > 0 && (
          <Polygon
            points={points.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')}
            fill={primaryColor}
            fillOpacity={0.3 * opacity}
            stroke={primaryColor}
            strokeWidth={2}
          />
        )}

        {/* Labels */}
        {showLabels &&
          validData.map((point, index) => {
            const angle = index * angleStep - Math.PI / 2;
            const labelRadius = radius + 20;
            const x = centerX + labelRadius * Math.cos(angle);
            const y = centerY + labelRadius * Math.sin(angle);
            if (!isFinite(x) || !isFinite(y)) return null;
            return (
              <SvgText
                key={index}
                x={x}
                y={y}
                fontSize={11}
                fill={mutedColor}
                textAnchor="middle"
                alignmentBaseline="middle"
              >
                {point.label || ''}
              </SvgText>
            );
          })}
      </Svg>
    </View>
  );
}

