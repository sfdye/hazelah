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

const LABEL_W = 84;

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
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * (width - LABEL_W);
      const y = height - ((v - min) / span) * (height - 12) - 6;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const suffix = unit ? ` ${unit}` : '';
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
        <SvgText
          x={width - 2}
          y={12}
          fontSize={10}
          fontWeight="600"
          fill={labelColor}
          textAnchor="end"
        >
          {`▲ ${max}${suffix}`}
        </SvgText>
        <SvgText
          x={width - 2}
          y={height - 2}
          fontSize={10}
          fontWeight="600"
          fill={labelColor}
          textAnchor="end"
        >
          {`▼ ${min}${suffix}`}
        </SvgText>
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2, width: width - LABEL_W }}>
        <Text style={{ fontSize: 10, color: labelColor }}>24h ago</Text>
        <Text style={{ fontSize: 10, color: labelColor }}>now</Text>
      </View>
    </View>
  );
}
