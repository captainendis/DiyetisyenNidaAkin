// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Son 7 gün: randevuların sonuçları (yığılmış sütun grafik) */
import { DateTime } from 'luxon';
import { StyleSheet, View } from 'react-native';
import { TIME_ZONE } from '@shared/constants';
import { T } from '@/components/ui';
import { colors, space } from '@/theme';
import { CHART_COLORS, type Weekly } from './types';

const SERIES = [
  { key: 'completed', label: 'Tamamlandı', color: CHART_COLORS.completed },
  { key: 'open', label: 'Onaylı / bekleyen', color: CHART_COLORS.open },
  { key: 'cancelled', label: 'İptal / gelmedi', color: CHART_COLORS.cancelled },
] as const;
const H = 120;

export function WeeklyChart({ days }: { days: Weekly['days'] }) {
  const max = Math.max(1, ...days.map((d) => d.completed + d.open + d.cancelled));
  return (
    <View style={{ gap: space.md }} accessible accessibilityLabel="Son 7 günde randevuların sonuçları: tamamlanan, bekleyen ve iptal/gelmedi sayıları">
      <View style={styles.chart}>
        {days.map((d) => {
          const dt = DateTime.fromISO(d.date, { zone: TIME_ZONE });
          const total = d.completed + d.open + d.cancelled;
          return (
            <View key={d.date} style={styles.col} accessible accessibilityLabel={`${dt.toFormat('d MMMM cccc')}: ${d.completed} tamamlandı, ${d.open} onaylı veya bekleyen, ${d.cancelled} iptal veya gelmedi`}>
              <T variant="caption" style={{ fontSize: 11 }}>{total || ''}</T>
              <View style={[styles.stack, { height: (total / max) * H }]}>
                {[...SERIES].reverse().map((s) => {
                  const v = d[s.key];
                  return v ? <View key={s.key} style={{ flex: v, backgroundColor: s.color }} /> : null;
                })}
              </View>
              <T variant="caption" style={{ fontSize: 11, textTransform: 'capitalize' }}>{dt.toFormat('ccc')}</T>
              <T variant="caption" style={{ fontSize: 10 }}>{dt.toFormat('d.MM')}</T>
            </View>
          );
        })}
      </View>
      <View style={styles.legend}>
        {SERIES.map((s) => (
          <View key={s.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: s.color }} />
            <T variant="caption">{s.label}</T>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line, paddingBottom: 2 },
  col: { flex: 1, alignItems: 'center', gap: 3, justifyContent: 'flex-end' },
  stack: { width: '70%', minHeight: 0, borderRadius: 4, overflow: 'hidden' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
});
