// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * "Kilo zaman içinde nasıl değişti?" — tek seri çizgi grafik (web: WeightTrend). Hedef kilo kesikli referans çizgisi.
 * Grafiğe dokunup sürükleyince en yakın ölçüm gösterilir.
 */
import { useMemo, useState } from 'react';
import { View, type GestureResponderEvent } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import type { PortalMeasurement } from '@shared/portal';
import { T } from '@/components/ui';
import { formatDayStr } from '@/lib/format';
import { colors, fonts, radius, space } from '@/theme';
import { kg } from './util';

const H = 210;
const PAD = { t: 16, r: 14, b: 26, l: 38 };
const LINE = '#7a6555';

export function WeightChart({ items }: { items: PortalMeasurement[] }) {
  const pts = useMemo(() => items.filter((m) => m.weightKg != null).sort((a, b) => a.measuredOn.localeCompare(b.measuredOn)), [items]);
  const target = items.find((m) => m.targetWeightKg != null)?.targetWeightKg ?? null;
  const [W, setW] = useState(320);
  const [hover, setHover] = useState<number | null>(null);

  if (pts.length < 2) return null;
  const t0 = Date.parse(pts[0]!.measuredOn);
  const t1 = Date.parse(pts[pts.length - 1]!.measuredOn);
  const vals = pts.map((p) => p.weightKg!).concat(target != null ? [target] : []);
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  const padV = Math.max(1, (hi - lo) * 0.15);
  lo = Math.floor(lo - padV);
  hi = Math.ceil(hi + padV);
  const x = (d: string) => PAD.l + ((Date.parse(d) - t0) / Math.max(1, t1 - t0)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
  const ticks = [lo, Math.round((lo + hi) / 2), hi];
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.measuredOn).toFixed(1)},${y(p.weightKg!).toFixed(1)}`).join(' ');
  const h = hover != null ? pts[hover] : null;

  const pick = (e: GestureResponderEvent) => {
    const px = e.nativeEvent.locationX;
    let best = 0;
    pts.forEach((p, i) => {
      if (Math.abs(x(p.measuredOn) - px) < Math.abs(x(pts[best]!.measuredOn) - px)) best = i;
    });
    setHover(best);
  };

  const first = pts[0]!;
  const lastP = pts[pts.length - 1]!;
  return (
    <View style={{ gap: space.sm }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 16, height: 2, backgroundColor: LINE, borderRadius: 1 }} />
          <T variant="caption">Kilo (kg)</T>
        </View>
        {target != null ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 16, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: colors.success }} />
            <T variant="caption">Hedef {kg(target)}</T>
          </View>
        ) : null}
      </View>
      <View
        onLayout={(e) => setW(Math.max(240, Math.floor(e.nativeEvent.layout.width)))}
        onStartShouldSetResponder={() => true}
        onResponderGrant={pick}
        onResponderMove={pick}
        onResponderRelease={() => setTimeout(() => setHover(null), 1800)}
        accessible
        accessibilityRole="image"
        accessibilityLabel={`Kilo grafiği: ${pts.length} ölçüm, ilk ${kg(first.weightKg!)}, son ${kg(lastP.weightKg!)}`}
      >
        <Svg width={W} height={H}>
          {ticks.map((t) => (
            <Line key={`l${t}`} x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke={colors.line} strokeWidth={1} />
          ))}
          {ticks.map((t) => (
            <SvgText key={`t${t}`} x={PAD.l - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill={colors.muted} fontFamily={fonts.regular}>
              {String(t)}
            </SvgText>
          ))}
          {target != null ? <Line x1={PAD.l} x2={W - PAD.r} y1={y(target)} y2={y(target)} stroke={colors.success} strokeWidth={1.5} strokeDasharray="5 4" /> : null}
          <Path d={path} fill="none" stroke={LINE} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {h ? <Line x1={x(h.measuredOn)} x2={x(h.measuredOn)} y1={PAD.t} y2={H - PAD.b} stroke={colors.espresso} strokeOpacity={0.25} strokeWidth={1} /> : null}
          {pts.map((p, i) => (
            <Circle key={p.id} cx={x(p.measuredOn)} cy={y(p.weightKg!)} r={hover === i ? 5.5 : 4} fill={LINE} stroke="#fff" strokeWidth={2} />
          ))}
          <SvgText x={PAD.l} y={H - 6} fontSize={11} fill={colors.muted} fontFamily={fonts.regular}>{formatDayStr(first.measuredOn, 'd MMM yyyy')}</SvgText>
          <SvgText x={W - PAD.r} y={H - 6} textAnchor="end" fontSize={11} fill={colors.muted} fontFamily={fonts.regular}>{formatDayStr(lastP.measuredOn, 'd MMM yyyy')}</SvgText>
        </Svg>
        {h ? (
          <View
            pointerEvents="none"
            style={{ position: 'absolute', top: 4, left: Math.max(0, Math.min(W - 130, x(h.measuredOn) - 65)), width: 130, backgroundColor: colors.espresso, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 6 }}
          >
            <T style={{ color: colors.ivory, fontFamily: fonts.bold, fontSize: 14 }}>{kg(h.weightKg!)}</T>
            <T style={{ color: colors.mist, fontSize: 11 }}>{formatDayStr(h.measuredOn, 'd MMMM yyyy')}</T>
          </View>
        ) : null}
      </View>
    </View>
  );
}
