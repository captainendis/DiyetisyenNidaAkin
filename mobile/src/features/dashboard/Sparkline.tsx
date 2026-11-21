// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Küçük eğilim çizgisi (web: charts/Sparkline.tsx) */
import Svg, { Circle, Path } from 'react-native-svg';
import { colors } from '@/theme';

export function Sparkline({ values, color = colors.cocoa, width = 88, height = 30, label }: { values: number[]; color?: string; width?: number; height?: number; label: string }) {
  if (!values.length) return null;
  const max = Math.max(1, ...values);
  const pad = 5;
  const step = values.length > 1 ? (width - pad * 2) / (values.length - 1) : 0;
  const pts = values.map((v, i) => [pad + i * step, height - pad - (v / max) * (height - pad * 2)] as const);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const first = pts[0]!;
  const last = pts[pts.length - 1]!;
  const area = `${d} L${last[0]},${height - pad} L${first[0]},${height - pad} Z`;
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} accessibilityLabel={label} accessible>
      <Path d={area} fill={color} opacity={0.08} />
      <Path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={last[0]} cy={last[1]} r={4} fill={color} stroke="#fff" strokeWidth={2} />
    </Svg>
  );
}
