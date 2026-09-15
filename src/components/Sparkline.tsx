import Svg, { Polyline } from 'react-native-svg';
import { View, Text } from 'react-native';

interface Props {
  values: number[];
  color: string;
  width: number;
  height?: number;
  unit?: string;
  labelColor?: string;
}

const LEGEND_W = 72;

export function Sparkline({
  values,
  color,
  width,
  height = 56,
  unit,
  labelColor = '#8b93a7',
}: Props) {
  if (values.length < 2) return null;
  const chartW = width - LEGEND_W;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 6;
  const points = values
    .map((v, i) => {
      const x = pad + (i / (values.length - 1)) * (chartW - 2 * pad);
      const y = height - ((v - min) / span) * (height - 6) - 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const suffix = unit ? ` ${unit}` : '';
  return (
    <View>
      <View style={{ flexDirection: 'row' }}>
        <Svg width={chartW} height={height}>
          <Polyline
            points={points}
            fill="none"
            stroke={color}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
        <View style={{ flex: 1, justifyContent: 'space-between', paddingLeft: 6 }}>
          <Text style={{ fontSize: 10, color: labelColor, fontWeight: '600' }}>
            {`▲ ${max}${suffix}`}
          </Text>
          <Text style={{ fontSize: 10, color: labelColor, fontWeight: '600' }}>
            {`▼ ${min}${suffix}`}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2, width: chartW }}>
        <Text style={{ fontSize: 10, color: labelColor }}>24h ago</Text>
        <Text style={{ fontSize: 10, color: labelColor }}>now</Text>
      </View>
    </View>
  );
}
