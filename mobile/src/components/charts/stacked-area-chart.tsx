import React, { useEffect } from 'react';
import { View, ViewStyle, Dimensions } from 'react-native';
import Svg, { Path, Line, Text as SvgText, G, Defs, LinearGradient, Stop } from 'react-native-svg';
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

export interface StackedAreaDataPoint {
  x: number;
  y: number[];
  label: string;
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

interface StackedAreaChartProps {
  data: StackedAreaDataPoint[];
  colors?: string[];
  categories?: string[];
  config?: ChartConfig;
  style?: ViewStyle;
}

export function StackedAreaChart({
  data,
  colors = [],
  categories = [],
  config = {},
  style,
}: StackedAreaChartProps) {
  const {
    width: configWidth,
    height = 200,
    padding = 20,
    showGrid = false,
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
    return null;
  }

  const numSeries = data[0]?.y?.length || 1;
  // Tons de azul do claro ao médio
  const defaultColors = [
    '#DBEAFE', // Azul muito claro
    '#BFDBFE', // Azul claro
    '#93C5FD', // Azul médio-claro
    '#60A5FA', // Azul médio
    '#3B82F6', // Azul médio-escuro
    '#2563EB', // Azul escuro
  ];
  const chartColors = colors.length > 0 ? colors : defaultColors.slice(0, numSeries);

  // Calcular maxValue com validação
  const values = data
    .filter((d) => d && d.y && Array.isArray(d.y))
    .flatMap((d) => {
      const sum = d.y.reduce((acc: number, val: number) => {
        const numVal = typeof val === 'number' && !isNaN(val) && isFinite(val) ? val : 0;
        return acc + numVal;
      }, 0);
      return sum;
    });

  const maxValue = values.length > 0 ? Math.max(...values) : 1;

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

  const getY = (value: number) => {
    if (!isFinite(value) || isNaN(value) || maxValue === 0) return innerHeight;
    const normalized = Math.max(0, Math.min(1, value / maxValue));
    return innerHeight - normalized * innerHeight;
  };

  const getX = (index: number) => {
    if (data.length <= 1) return 0;
    const normalized = index / (data.length - 1);
    return Math.max(0, Math.min(innerWidth, normalized * innerWidth));
  };

  const createPath = (seriesIndex: number) => {
    let path = '';
    const topPoints: { x: number; y: number }[] = [];
    const bottomPoints: { x: number; y: number }[] = [];

    data.forEach((point, index) => {
      if (!point || !point.y || !Array.isArray(point.y)) return;
      
      const x = getX(index);
      let cumulativeTop = 0;
      let cumulativeBottom = 0;

      for (let i = 0; i < seriesIndex; i++) {
        const val = point.y[i];
        if (typeof val === 'number' && !isNaN(val) && isFinite(val)) {
          cumulativeTop += val;
        }
      }
      
      const seriesVal = point.y[seriesIndex];
      if (typeof seriesVal === 'number' && !isNaN(seriesVal) && isFinite(seriesVal)) {
        cumulativeBottom = cumulativeTop + seriesVal;
      } else {
        cumulativeBottom = cumulativeTop;
      }

      const topY = getY(cumulativeTop);
      const bottomY = getY(cumulativeBottom);
      
      if (isFinite(x) && isFinite(topY) && isFinite(bottomY)) {
        topPoints.push({ x, y: topY });
        bottomPoints.push({ x, y: bottomY });
      }
    });

    if (bottomPoints.length === 0) return '';

    bottomPoints.forEach((point, index) => {
      if (index === 0) {
        path += `M ${point.x.toFixed(2)} ${point.y.toFixed(2)} `;
      } else {
        path += `L ${point.x.toFixed(2)} ${point.y.toFixed(2)} `;
      }
    });

    for (let i = topPoints.length - 1; i >= 0; i--) {
      path += `L ${topPoints[i].x.toFixed(2)} ${topPoints[i].y.toFixed(2)} `;
    }

    path += 'Z';
    return path;
  };

  return (
    <View style={[{ width: chartWidth, height }, style]}>
      <Svg width={chartWidth} height={height}>
        <Defs>
          {chartColors.map((color, index) => (
            <LinearGradient key={index} id={`gradient-${index}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor={color} stopOpacity={0.6 * opacity} />
              <Stop offset="100%" stopColor={color} stopOpacity={0.2 * opacity} />
            </LinearGradient>
          ))}
        </Defs>

        <G x={padding} y={padding}>
          {/* Grid lines */}
          {showGrid &&
            [0, 0.25, 0.5, 0.75, 1.0].map((scale) => {
              const y = innerHeight * scale;
              return (
                <Line
                  key={scale}
                  x1={0}
                  y1={y}
                  x2={innerWidth}
                  y2={y}
                  stroke={mutedColor}
                  strokeWidth={1}
                  opacity={0.2}
                  strokeDasharray="4,4"
                />
              );
            })}

          {/* Stacked areas */}
          {Array.from({ length: numSeries }).map((_, seriesIndex) => {
            const path = createPath(seriesIndex);
            if (!path || path.length < 10) return null; // Path muito curto é inválido
            return (
              <Path
                key={seriesIndex}
                d={path}
                fill={`url(#gradient-${seriesIndex})`}
                stroke={chartColors[seriesIndex] || primaryColor}
                strokeWidth={2}
              />
            );
          })}

          {/* Labels */}
          {showLabels &&
            data
              .filter((point) => point && point.label)
              .map((point, index) => {
                const x = getX(index);
                if (!isFinite(x)) return null;
                return (
                  <SvgText
                    key={index}
                    x={x}
                    y={innerHeight + 15}
                    fontSize={11}
                    fill={mutedColor}
                    textAnchor="middle"
                  >
                    {point.label || ''}
                  </SvgText>
                );
              })}
        </G>
      </Svg>
    </View>
  );
}

