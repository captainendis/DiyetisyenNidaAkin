// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Takvim yardımcıları (mobil): tarih aralığı, veri sorgusu ve ay ızgarası.
 *  - Gün/hafta: saat ızgarası ve sürükle-bırak ile yeniden planlama → TimeGrid.tsx
 *  - Ay: gün başına randevu sayısı; güne dokununca gün görünümü.
 */
import { DateTime } from 'luxon';
import { Pressable, StyleSheet, View } from 'react-native';
import { TIME_ZONE } from '@shared/constants';
import type { ClassSessionDTO } from '@shared/classes';
import { todayStr } from '@shared/time';
import { Card, T } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDayStr } from '@/lib/format';
import { useApiQuery } from '@/lib/query';
import { colors, fonts, space } from '@/theme';
import type { AppointmentDTO, DayPlanDTO } from './types';

export type CalView = 'day' | 'week' | 'month';

export function rangeFor(view: CalView, anchor: string): [string, string] {
  const a = DateTime.fromISO(anchor, { zone: TIME_ZONE });
  if (view === 'day') return [anchor, anchor];
  if (view === 'week') return [a.startOf('week').toISODate()!, a.endOf('week').toISODate()!];
  return [a.startOf('month').startOf('week').toISODate()!, a.endOf('month').endOf('week').toISODate()!];
}

export function shiftAnchor(view: CalView, anchor: string, dir: -1 | 1) {
  const a = DateTime.fromISO(anchor, { zone: TIME_ZONE });
  const n = view === 'day' ? a.plus({ days: dir }) : view === 'week' ? a.plus({ weeks: dir }) : a.plus({ months: dir });
  return n.toISODate()!;
}

export function rangeTitle(view: CalView, anchor: string, from: string, to: string) {
  const a = DateTime.fromISO(anchor, { zone: TIME_ZONE });
  if (view === 'day') return a.toFormat('d MMMM yyyy, cccc');
  if (view === 'month') return a.toFormat('LLLL yyyy');
  const s = DateTime.fromISO(from, { zone: TIME_ZONE });
  const e = DateTime.fromISO(to, { zone: TIME_ZONE });
  return s.month === e.month ? `${s.day}–${e.toFormat('d MMMM yyyy')}` : `${s.toFormat('d MMM')} – ${e.toFormat('d MMM yyyy')}`;
}

export function eachDayOf(from: string, to: string) {
  const out: string[] = [];
  for (let d = DateTime.fromISO(from, { zone: TIME_ZONE }); d.toISODate()! <= to; d = d.plus({ days: 1 })) out.push(d.toISODate()!);
  return out;
}

export interface RangeData {
  items: AppointmentDTO[];
  classes: ClassSessionDTO[];
  plans: Map<string, DayPlanDTO>;
}

export function useCalendarRange(from: string, to: string, enabled: boolean) {
  return useApiQuery(
    ['appointments', 'range', from, to],
    async (): Promise<RangeData> => {
      const [appts, plans, classes] = await Promise.all([
        api.get<{ items: AppointmentDTO[] }>('/appointments', { from, to, pageSize: 500, sort: 'startsAt' }),
        api.get<{ days: DayPlanDTO[] }>('/appointments/day-plans', { from, to }),
        // Pilates dersleri de takvimde zaman kaplar
        api.get<{ items: ClassSessionDTO[] }>('/classes/sessions', { from, to, includeCancelled: '1' }).catch(() => ({ items: [] as ClassSessionDTO[] })),
      ]);
      return { items: appts.items.filter((a) => a.date), classes: classes.items, plans: new Map(plans.days.map((p) => [p.date, p])) };
    },
    { enabled },
  );
}

const WEEK_HEAD = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

export function MonthView({ anchor, from, to, data, showCancelled, onPickDay }: { anchor: string; from: string; to: string; data: RangeData; showCancelled: boolean; onPickDay: (d: string) => void }) {
  const month = anchor.slice(0, 7);
  const today = todayStr();
  const days = eachDayOf(from, to);
  const counts = new Map<string, { appts: number; classes: number; pending: number }>();
  for (const a of data.items) {
    if (!a.date || (!showCancelled && (a.status === 'CANCELLED' || a.status === 'NO_SHOW'))) continue;
    const c = counts.get(a.date) ?? { appts: 0, classes: 0, pending: 0 };
    c.appts++;
    if (a.status === 'PENDING' || a.status === 'NEW_REQUEST') c.pending++;
    counts.set(a.date, c);
  }
  for (const s of data.classes) {
    if (!showCancelled && s.status === 'CANCELLED') continue;
    const c = counts.get(s.date) ?? { appts: 0, classes: 0, pending: 0 };
    c.classes++;
    counts.set(s.date, c);
  }
  const weeks: string[][] = [];
  days.forEach((d, i) => (i % 7 === 0 ? weeks.push([d]) : weeks[weeks.length - 1]!.push(d)));

  return (
    <Card padded={false} style={{ overflow: 'hidden' }}>
      <View style={styles.weekRow}>
        {WEEK_HEAD.map((w) => (
          <View key={w} style={[styles.cell, { minHeight: 28 }]}>
            <T variant="caption" weight="semibold">{w}</T>
          </View>
        ))}
      </View>
      {weeks.map((w) => (
        <View key={w[0]} style={styles.weekRow}>
          {w.map((d) => {
            const c = counts.get(d);
            const plan = data.plans.get(d);
            const inMonth = d.startsWith(month);
            const closed = plan && !plan.isWorking;
            const label = `${formatDayStr(d, 'd MMMM cccc')}${c ? `, ${c.appts} randevu${c.classes ? `, ${c.classes} ders` : ''}` : ''}${closed ? ', kapalı' : ''}`;
            return (
              <Pressable key={d} onPress={() => onPickDay(d)} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [styles.cell, closed && { backgroundColor: '#F3EEE6' }, pressed && { backgroundColor: '#EFE8DD' }]}>
                <View style={[styles.dayNum, d === today && { backgroundColor: colors.espresso }]}>
                  <T style={{ fontFamily: fonts.semibold, fontSize: 13, color: d === today ? colors.cream : inMonth ? colors.text : colors.mist }}>{Number(d.slice(8))}</T>
                </View>
                {c?.appts ? (
                  <View style={[styles.count, { backgroundColor: c.pending ? colors.warningBg : colors.successBg }]}>
                    <T style={{ fontSize: 11, fontFamily: fonts.bold, color: c.pending ? colors.warningInk : colors.successInk }}>{c.appts}</T>
                  </View>
                ) : null}
                {c?.classes ? <View style={styles.classDot} /> : null}
              </Pressable>
            );
          })}
        </View>
      ))}
      <View style={styles.legend}>
        <Legend color={colors.successBg} label="Randevu" />
        <Legend color={colors.warningBg} label="Onay bekleyen var" />
        <Legend color={colors.info} label="Pilates" dot />
      </View>
    </Card>
  );
}

function Legend({ color, label, dot }: { color: string; label: string; dot?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <View style={{ width: dot ? 6 : 12, height: dot ? 6 : 12, borderRadius: 6, backgroundColor: color }} />
      <T variant="caption">{label}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  weekRow: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  cell: { flex: 1, minHeight: 58, alignItems: 'center', paddingVertical: 6, gap: 3 },
  dayNum: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  count: { minWidth: 20, paddingHorizontal: 5, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  classDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.info },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, padding: space.md },
});
