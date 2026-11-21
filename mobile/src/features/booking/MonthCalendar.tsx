// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Ay takvimi — müsait günler noktayla işaretli, seçilebilir (web: BookingForm → MonthCalendar) */
import { DateTime } from 'luxon';
import { Pressable, StyleSheet, View } from 'react-native';
import { TIME_ZONE } from '@shared/constants';
import { Icon, T } from '@/components/ui';
import { colors, fonts, space } from '@/theme';

const WEEK = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

/** "yyyy-MM-01" biçiminde ay başı */
export const monthOf = (date: string) => `${date.slice(0, 7)}-01`;
export const shiftMonth = (month: string, n: number) => DateTime.fromISO(month, { zone: TIME_ZONE }).plus({ months: n }).toISODate()!;
export const monthEnd = (month: string) => DateTime.fromISO(month, { zone: TIME_ZONE }).endOf('month').toISODate()!;

export function MonthCalendar({
  month,
  onMonth,
  days,
  selected,
  onSelect,
  minDate,
  maxDate,
  loading,
}: {
  month: string;
  onMonth: (m: string) => void;
  days: Map<string, number>;
  selected: string | null;
  onSelect: (d: string) => void;
  minDate: string;
  maxDate: string;
  loading: boolean;
}) {
  const start = DateTime.fromISO(month, { zone: TIME_ZONE }).setLocale('tr');
  const lead = start.weekday - 1; // Pazartesi başlangıçlı
  const total = start.daysInMonth ?? 30;
  const cells: (DateTime | null)[] = [...Array<null>(lead).fill(null), ...Array.from({ length: total }, (_, i) => start.plus({ days: i }))];
  while (cells.length % 7) cells.push(null);
  const canPrev = month > monthOf(minDate);
  const canNext = month < monthOf(maxDate);

  return (
    <View>
      <View style={styles.head}>
        <T variant="title" style={{ textTransform: 'capitalize', flex: 1 }}>{start.toFormat('LLLL yyyy')}</T>
        <Pressable onPress={() => onMonth(shiftMonth(month, -1))} disabled={!canPrev} accessibilityRole="button" accessibilityLabel="Önceki ay" hitSlop={6} style={[styles.nav, !canPrev && { opacity: 0.25 }]}>
          <Icon name="chevron-left" size={20} />
        </Pressable>
        <Pressable onPress={() => onMonth(shiftMonth(month, 1))} disabled={!canNext} accessibilityRole="button" accessibilityLabel="Sonraki ay" hitSlop={6} style={[styles.nav, !canNext && { opacity: 0.25 }]}>
          <Icon name="chevron-right" size={20} />
        </Pressable>
      </View>
      <View style={styles.grid}>
        {WEEK.map((d) => (
          <View key={d} style={styles.cell}>
            <T style={styles.week}>{d}</T>
          </View>
        ))}
      </View>
      <View style={[styles.grid, loading && { opacity: 0.4 }]}>
        {cells.map((c, i) => {
          if (!c) return <View key={`e${i}`} style={styles.cell} />;
          const iso = c.toISODate()!;
          const avail = days.get(iso) ?? 0;
          const sel = selected === iso;
          return (
            <View key={iso} style={styles.cell}>
              <Pressable
                disabled={avail === 0}
                onPress={() => onSelect(iso)}
                accessibilityRole="button"
                accessibilityState={{ selected: sel, disabled: avail === 0 }}
                accessibilityLabel={`${c.toFormat('d MMMM cccc')}${avail ? `, ${avail} uygun saat` : ', uygun saat yok'}`}
                style={[styles.day, sel && styles.daySel]}
              >
                <T style={[styles.dayText, { color: sel ? colors.cream : avail ? colors.text : colors.mist }]}>{c.day}</T>
                {avail > 0 && !sel ? <View style={styles.dot} /> : null}
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginBottom: space.md },
  nav: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, padding: 2, alignItems: 'center', justifyContent: 'center' },
  week: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 0.8, color: colors.muted, textTransform: 'uppercase' },
  day: { flex: 1, alignSelf: 'stretch', borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  daySel: { backgroundColor: colors.espresso },
  dayText: { fontFamily: fonts.medium, fontSize: 15, fontVariant: ['tabular-nums'] },
  dot: { position: 'absolute', bottom: 6, width: 4, height: 4, borderRadius: 2, backgroundColor: colors.roseDeep },
});
