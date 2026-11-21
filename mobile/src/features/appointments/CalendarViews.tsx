// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Takvim görünümleri (mobil): gün / hafta ajandası ve ay ızgarası.
 *  - Gün/hafta: güne göre gruplanmış randevular ve pilates dersleri, çalışma saatleri ya da kapalı gün nedeni.
 *    Gün görünümünde boş saatler listelenir; dokununca o saate yeni randevu açılır (web'deki boş alana tıklama).
 *  - Ay: gün başına randevu sayısı; güne dokununca gün görünümü.
 * Sürükle-bırak yerine yeniden planlama randevu detayındaki "Tarihi / saati değiştir" ile yapılır.
 */
import { DateTime } from 'luxon';
import { Pressable, StyleSheet, View } from 'react-native';
import { TIME_ZONE, CLASS_SESSION_STATUS_LABEL } from '@shared/constants';
import type { ClassSessionDTO } from '@shared/classes';
import { minutesOf, timeOf, todayStr } from '@shared/time';
import { Badge, Card, Icon, T } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDayStr } from '@/lib/format';
import { useApiQuery } from '@/lib/query';
import { colors, fonts, radius, space } from '@/theme';
import { AppointmentRow } from './AppointmentRow';
import type { AppointmentDTO, DayPlanDTO, SlotDTO } from './types';

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

const windowsText = (p: DayPlanDTO | undefined) =>
  !p ? '' : !p.isWorking ? p.closedReason ?? 'Kapalı' : p.windows.map((w) => `${timeOf(w.start)}–${timeOf(w.end)}`).join(', ');

type Entry = { kind: 'appt'; a: AppointmentDTO; at: string } | { kind: 'class'; c: ClassSessionDTO; at: string };

function ClassRow({ c, last, onPress }: { c: ClassSessionDTO; last: boolean; onPress: () => void }) {
  const cancelled = c.status === 'CANCELLED';
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Pilates dersi ${c.time} ${c.groupName ?? c.title}`} style={({ pressed }) => pressed && { backgroundColor: '#F8F4EE' }}>
      <View style={[styles.classRow, !last && styles.line, cancelled && { opacity: 0.6 }]}>
        <View style={{ width: 64, alignItems: 'flex-end' }}>
          <T style={styles.time}>{c.time}</T>
          <T variant="caption">{timeOf(minutesOf(c.time) + c.durationMinutes)}</T>
        </View>
        <View style={[styles.bar, { backgroundColor: colors.info }]} />
        <View style={{ flex: 1, gap: 3 }}>
          <T variant="subheading" numberOfLines={1}>{c.groupName ?? c.title}</T>
          <T variant="caption">Pilates · {c.seatsTaken}/{c.capacity} kişi</T>
          <Badge label={CLASS_SESSION_STATUS_LABEL[c.status]} tone={cancelled ? 'neutral' : 'info'} />
        </View>
        <Icon name="chevron-right" size={18} color={colors.mist} />
      </View>
    </Pressable>
  );
}

/** Boş saatler (gün görünümü) — dokununca o saate yeni randevu */
function FreeSlots({ date, onCreate }: { date: string; onCreate: (date: string, time: string) => void }) {
  const q = useApiQuery(['appointments', 'slots', date, null, null], () => api.get<{ slots: SlotDTO[] }>('/appointments/slots', { date }), { staleTime: 0 });
  const free = (q.data?.slots ?? []).filter((s) => s.available);
  if (!free.length) return null;
  return (
    <View style={{ gap: space.sm, marginTop: space.md }}>
      <T variant="overline">Boş saatler · dokunarak randevu ekleyin</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {free.map((s) => (
          <Pressable key={s.time} onPress={() => onCreate(date, s.time)} accessibilityRole="button" accessibilityLabel={`${s.time} için yeni randevu`} style={({ pressed }) => [styles.free, pressed && { opacity: 0.7 }]}>
            <Icon name="plus" size={13} color={colors.successInk} />
            <T style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.successInk }}>{s.time}</T>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function AgendaView({
  days,
  data,
  showCancelled,
  onOpen,
  onOpenClass,
  onCreate,
}: {
  days: string[];
  data: RangeData;
  showCancelled: boolean;
  onOpen: (id: string) => void;
  onOpenClass: (c: ClassSessionDTO) => void;
  /** Yazma izni yoksa verilmez */
  onCreate?: (date: string, time: string) => void;
}) {
  const today = todayStr();
  const single = days.length === 1;
  const items = data.items.filter((a) => showCancelled || (a.status !== 'CANCELLED' && a.status !== 'NO_SHOW'));
  const classes = data.classes.filter((c) => showCancelled || c.status !== 'CANCELLED');
  const total = items.length + classes.length;

  return (
    <View style={{ gap: space.lg }}>
      {days.map((d) => {
        const entries: Entry[] = [
          ...items.filter((a) => a.date === d).map((a) => ({ kind: 'appt' as const, a, at: a.time ?? '' })),
          ...classes.filter((c) => c.date === d).map((c) => ({ kind: 'class' as const, c, at: c.time })),
        ].sort((x, y) => x.at.localeCompare(y.at));
        const plan = data.plans.get(d);
        // Haftada boş ve kapalı geçmiş günleri sadeleştir
        if (!single && !entries.length && d < today) return null;
        return (
          <View key={d} style={{ gap: space.sm }}>
            {!single ? (
              <View style={styles.dayHead}>
                <T variant="heading" style={{ textTransform: 'capitalize' }}>{formatDayStr(d, 'd MMMM, cccc')}</T>
                {d === today ? <Badge label="Bugün" tone="gold" /> : null}
              </View>
            ) : null}
            <T variant="caption">{plan?.isWorking ? `Çalışma saatleri: ${windowsText(plan)}` : windowsText(plan) || 'Kapalı'}</T>
            {entries.length ? (
              <Card padded={false} style={{ overflow: 'hidden' }}>
                {entries.map((e, i) =>
                  e.kind === 'appt' ? (
                    <AppointmentRow key={e.a.id} appointment={e.a} last={i === entries.length - 1} onPress={() => onOpen(e.a.id)} />
                  ) : (
                    <ClassRow key={e.c.id} c={e.c} last={i === entries.length - 1} onPress={() => onOpenClass(e.c)} />
                  ),
                )}
              </Card>
            ) : single || d >= today ? (
              <Card style={{ paddingVertical: space.md }}>
                <T variant="caption">Bu gün için randevu bulunmuyor.</T>
              </Card>
            ) : null}
            {single && onCreate && d >= today ? <FreeSlots date={d} onCreate={onCreate} /> : null}
          </View>
        );
      })}
      {!single && total === 0 ? <T variant="caption" center>Bu hafta için randevu bulunmuyor.</T> : null}
    </View>
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
  line: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  classRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 12, paddingHorizontal: space.lg },
  time: { fontFamily: fonts.bold, fontSize: 16, color: colors.text, fontVariant: ['tabular-nums'] },
  bar: { width: 3, alignSelf: 'stretch', borderRadius: 2 },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  free: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 40, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.successBg },
  weekRow: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  cell: { flex: 1, minHeight: 58, alignItems: 'center', paddingVertical: 6, gap: 3 },
  dayNum: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  count: { minWidth: 20, paddingHorizontal: 5, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  classDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.info },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, padding: space.md },
});
