import Svg, { Polyline, Text as SvgText } from 'react-native-svg';
import { View, Text } from 'react-native';

interface Props {
  values: number[];
  color: string;
  width: number;
  height?: number;
  unit?: string;
  labelColor?: string;
}

export function Sparkline({
  values,
  color,
  width,
  height = 56,
  unit,
  labelColor = '#8b93a7',
}: Props) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 6;
  const points = values
    .map((v, i) => {
      const x = pad + (i / (values.length - 1)) * (width - 2 * pad);
      const y = height - ((v - min) / span) * (height - 6) - 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <View>
      <Svg width={width} height={height}>
        <Polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <SvgText x={pad} y={12} fontSize={10} fill={labelColor} fontWeight="600">
          {`${max}${unit ? ` ${unit}` : ''}`}
        </SvgText>
        <SvgText x={pad} y={height - 2} fontSize={10} fill={labelColor} fontWeight="600">
          {`${min}${unit ? ` ${unit}` : ''}`}
        </SvgText>
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
        <Text style={{ fontSize: 10, color: labelColor }}>24h ago</Text>
        <Text style={{ fontSize: 10, color: labelColor }}>now</Text>
      </View>
    </View>
  );
}
