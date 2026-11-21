// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Rapor grafikleri (web: reports/VolumeChart.tsx, ProportionBars.tsx).
 * VolumeChart: tek seri dikey çubuk grafik; çubuğa dokununca dönemin kırılımı gösterilir.
 * ProportionBars: doğrudan etiketli yatay oran çubukları (renk tek başına anlam taşımaz).
 */
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Svg, { Line, Path, Text as SvgText } from 'react-native-svg';
import { T } from '@/components/ui';
import { colors, fonts, radius, space } from '@/theme';
import type { ReportBucket } from './types';

const H = 220;
const PAD = { t: 12, r: 8, b: 26, l: 32 };

function niceMax(v: number) {
  if (v <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  return (n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

export function VolumeChart({ buckets, ariaLabel }: { buckets: ReportBucket[]; ariaLabel: string }) {
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const W = Math.max(width, buckets.length * 14 + PAD.l + PAD.r);
  const max = niceMax(Math.max(1, ...buckets.map((b) => b.total)));
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const slot = buckets.length ? innerW / buckets.length : innerW;
  const barW = Math.max(4, Math.min(32, slot - 3));
  const y = (v: number) => PAD.t + innerH - (v / max) * innerH;
  const ticks = [0, max / 2, max];
  const labelEvery = Math.ceil(buckets.length / Math.max(1, Math.floor(innerW / 56)));
  const a = active != null ? buckets[active] : null;
  const base = PAD.t + innerH;

  return (
    <View style={{ gap: space.md }}>
      <View onLayout={(e) => setWidth(Math.floor(e.nativeEvent.layout.width))} accessibilityHint={ariaLabel}>
        {width > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={W > width} scrollEnabled={W > width}>
            <View style={{ width: W, height: H }}>
              <Svg width={W} height={H}>
                {ticks.map((t) => (
                  <Line key={`l${t}`} x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke={colors.line} strokeWidth={1} />
                ))}
                {ticks.map((t) => (
                  <SvgText key={`t${t}`} x={PAD.l - 6} y={y(t) + 3.5} fontSize={10} fill={colors.muted} textAnchor="end" fontFamily={fonts.regular}>
                    {String(t)}
                  </SvgText>
                ))}
                {buckets.map((b, i) => {
                  if (!b.total) return null;
                  const x = PAD.l + i * slot + (slot - barW) / 2;
                  const h = Math.max(2, base - y(b.total));
                  const r = Math.min(4, barW / 2, h);
                  return (
                    <Path
                      key={b.key}
                      d={`M${x},${base} V${base - h + r} Q${x},${base - h} ${x + r},${base - h} H${x + barW - r} Q${x + barW},${base - h} ${x + barW},${base - h + r} V${base} Z`}
                      fill={active === i ? colors.espresso : colors.taupe}
                    />
                  );
                })}
                {buckets.map((b, i) =>
                  i % labelEvery === 0 ? (
                    <SvgText key={`x${b.key}`} x={PAD.l + i * slot + slot / 2} y={H - 8} fontSize={10} fill={colors.muted} textAnchor="middle" fontFamily={fonts.regular}>
                      {b.label.replace(' haftası', '')}
                    </SvgText>
                  ) : null,
                )}
              </Svg>
              {/* Dokunma hedefleri (her çubuk için tam yükseklik) */}
              {buckets.map((b, i) => (
                <Pressable
                  key={`p${b.key}`}
                  onPress={() => setActive(active === i ? null : i)}
                  accessibilityRole="button"
                  accessibilityLabel={`${b.label}: ${b.total} randevu`}
                  style={{ position: 'absolute', left: PAD.l + i * slot, top: PAD.t, width: slot, height: innerH }}
                />
              ))}
            </View>
          </ScrollView>
        ) : (
          <View style={{ height: H }} />
        )}
      </View>
      {a ? (
        <View style={{ backgroundColor: colors.espresso, borderRadius: radius.md, padding: space.md, gap: 4 }} accessibilityLiveRegion="polite">
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm }}>
            <T style={{ color: colors.ivory, fontFamily: fonts.bold, fontSize: 16 }}>{a.total} randevu</T>
            <T style={{ color: colors.mist, fontSize: 12 }}>{a.label}</T>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: space.lg, rowGap: 2 }}>
            {[
              ['Tamamlandı', a.completed],
              ['Onaylı / bekleyen', a.confirmed + a.pending],
              ['İptal', a.cancelled],
              ['Gelmedi', a.noShow],
            ].map(([l, v]) => (
              <T key={String(l)} style={{ color: colors.cream, fontSize: 12 }}>
                <T style={{ color: colors.mist, fontSize: 12 }}>{l} </T>
                {v}
              </T>
            ))}
          </View>
        </View>
      ) : (
        <T variant="caption">Ayrıntı için bir çubuğa dokunun.</T>
      )}
    </View>
  );
}

export interface ProportionRow {
  key: string;
  label: string;
  value: number;
  tone?: 'base' | 'muted';
}

export function ProportionBars({ rows, total }: { rows: ProportionRow[]; total: number }) {
  return (
    <View style={{ gap: 14 }}>
      {rows.map((r) => {
        const pct = total ? Math.round((r.value / total) * 100) : 0;
        return (
          <View key={r.key} style={{ gap: 6 }} accessible accessibilityLabel={`${r.label}: ${r.value}, yüzde ${pct}`}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space.md }}>
              <T style={{ flex: 1 }}>{r.label}</T>
              <T>
                <T weight="semibold">{r.value}</T>
                <T variant="caption"> %{pct}</T>
              </T>
            </View>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.bg, overflow: 'hidden' }}>
              <View style={{ width: `${pct}%`, height: '100%', borderRadius: 4, backgroundColor: r.tone === 'muted' ? colors.mist : colors.taupe }} />
            </View>
          </View>
        );
      })}
    </View>
  );
}
