import { View, ViewStyle, Dimensions } from 'react-native';
import Svg, { Circle, Line, Polygon, Text as SvgText, G } from 'react-native-svg';
import { useColor } from '@/hooks/useColor';
import { Text } from '@/components/ui/text';

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
    maxValue: configMaxValue,
  } = config;

  // Hooks devem ser chamados incondicionalmente
  const primaryColor = '#60A5FA';
  const mutedColor = useColor({}, 'textMuted');
  const { width: screenWidth } = Dimensions.get('window');
  
  // Validação de dados (após todos os hooks)
  const validData = (data || []).filter(
    (d) => d && typeof d.value === 'number' && !isNaN(d.value) && isFinite(d.value)
  );
  
  // Se não há dados válidos, mostrar mensagem
  if (validData.length === 0) {
    return (
      <View style={[{ width: configWidth || 200, height, alignItems: 'center', justifyContent: 'center' }, style]}>
        <Text variant="caption" style={{ color: mutedColor }}>
          Sem dados disponíveis
        </Text>
      </View>
    );
  }

  const chartWidth = configWidth || Math.min(screenWidth - 48, height);
  const centerX = chartWidth / 2;
  const centerY = height / 2;
  const radius = Math.min(centerX, centerY) - 60;

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

  return (
    <View style={[{ width: chartWidth, height }, style]}>
      <Svg width={chartWidth} height={height}>
        {/* Grid circles */}
        {[0.2, 0.4, 0.6, 0.8, 1.0].map((scale, idx) => (
          <G key={`grid-${idx}`}>
          <Circle
            cx={centerX}
            cy={centerY}
            r={radius * scale}
            fill="none"
            stroke={mutedColor}
            strokeWidth={1}
            opacity={0.2}
          />
          </G>
        ))}

        {/* Grid lines */}
        {validData.map((_, index) => {
          const angle = index * angleStep - Math.PI / 2;
          const x = centerX + radius * Math.cos(angle);
          const y = centerY + radius * Math.sin(angle);
          if (!isFinite(x) || !isFinite(y)) return null;
          return (
            <G key={`line-${index}`}>
            <Line
              x1={centerX}
              y1={centerY}
              x2={x}
              y2={y}
              stroke={mutedColor}
              strokeWidth={1}
              opacity={0.2}
            />
            </G>
          );
        })}

        {/* Data area */}
        {points.length > 0 && (
          <Polygon
            points={points.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')}
            fill={primaryColor}
            fillOpacity={0.4}
            stroke={primaryColor}
            strokeWidth={3}
          />
        )}
        
        {/* Data points markers */}
        {points.map((point, index) => (
          <G key={`point-${index}`}>
            <Circle
              cx={point.x}
              cy={point.y}
              r={4}
              fill={primaryColor}
              stroke="#FFFFFF"
            strokeWidth={2}
          />
          </G>
        ))}

        {/* Labels */}
        {showLabels &&
          validData.map((point, index) => {
            const angle = index * angleStep - Math.PI / 2;
            const labelRadius = radius + 35;
            const x = centerX + labelRadius * Math.cos(angle);
            const y = centerY + labelRadius * Math.sin(angle);
            if (!isFinite(x) || !isFinite(y)) return null;
            return (
              <G key={`label-${index}`}>
              <SvgText
                x={x}
                y={y}
                  fontSize={14}
                fill={mutedColor}
                textAnchor="middle"
                alignmentBaseline="middle"
                  fontWeight="600"
              >
                {point.label || ''}
              </SvgText>
              </G>
            );
          })}
      </Svg>
    </View>
  );
}
