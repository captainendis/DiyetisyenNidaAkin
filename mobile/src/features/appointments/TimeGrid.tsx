// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Gün / hafta saat ızgarası (mobil) — web'deki TimeGrid'in (src/components/panel/appointments/CalendarViews.tsx) karşılığı.
 *  - Solda saat ekseni; çalışma pencereleri beyaz, dışı taranmış zemin; bugünün sütununda "şimdi" çizgisi.
 *  - Randevular durum renginde, pilates dersleri ayrı renkte (salt okunur; dokununca ders detayı) mutlak konumlu bloklar.
 *  - Sürükle-bırak: randevuya ~250 ms basılı tut (titreşim) → blok kalkar; dikey sürükleme saati (15 dk yakalama),
 *    hafta görünümünde yatay sürükleme günü değiştirir. Sürüklerken hedef saat etiketi gösterilir, kenara yaklaşınca
 *    ızgara kendiliğinden kayar. Bırakınca onay → PATCH; hata olursa blok yerine döner.
 *    Yalnızca appointments:write izniyle ve web'deki gibi Yeni talep / Onay bekliyor / Onaylandı durumlarında.
 *  - Boş alana basılı tutma → o saate yeni randevu (web'de boş alana tıklama).
 *  - Ekran okuyucu kullanıcıları sürükleyemez: blok "aç" eylemi sunar; yeniden planlama randevu detayındaki
 *    "Tarihi / saati değiştir" ile yapılır.
 */
import * as Haptics from 'expo-haptics';
import { DateTime } from 'luxon';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View, type AccessibilityActionEvent, type ScrollView as RNScrollView } from 'react-native';
import {
  GestureDetector,
  RefreshControl,
  ScrollView,
  useCompetingGestures,
  useLongPressGesture,
  usePanGesture,
  useTapGesture,
} from 'react-native-gesture-handler';
import Animated, {
  measure,
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedStyle,
  useFrameCallback,
  useScrollOffset,
  useSharedValue,
  withTiming,
  type AnimatedRef,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { APPOINTMENT_STATUS_LABEL, TIME_ZONE, type AppointmentStatus } from '@shared/constants';
import type { ClassSessionDTO } from '@shared/classes';
import { minutesOf, timeOf } from '@shared/time';
import { Icon, T } from '@/components/ui';
import { colors, fonts, radius, space } from '@/theme';
import type { RangeData } from './CalendarViews';
import { displayName, type AppointmentDTO, type DayPlanDTO } from './types';

/** Web ile aynı: saat yüksekliği, yakalama adımı, sürüklenebilir durumlar */
const HOUR_PX = 64;
const SNAP = 15;
const DRAGGABLE = new Set<AppointmentStatus>(['NEW_REQUEST', 'PENDING', 'CONFIRMED']);
const LIFT_MS = 250;
const CREATE_MS = 450;
const AXIS_W = 38;
const MIN_BLOCK = 22;
/** Otomatik kaydırma: kenar bölgesi (pt) ve kare başına en yüksek hız */
const EDGE = 56;
const MAX_SPEED = 12;
const TOP_PAD = 10;

/** Takvim blok renkleri (web: STATUS_BLOCK) */
const BLOCK: Record<AppointmentStatus, { bg: string; border: string; fg: string; strike?: boolean }> = {
  NEW_REQUEST: { bg: '#F7E7E2', border: colors.roseDeep, fg: colors.roseInk },
  PENDING: { bg: colors.warningBg, border: colors.warning, fg: colors.warningInk },
  CONFIRMED: { bg: colors.successBg, border: colors.success, fg: colors.successInk },
  COMPLETED: { bg: '#EAE5E0', border: colors.cocoa, fg: colors.cocoa },
  CANCELLED: { bg: colors.dangerBg, border: colors.danger, fg: colors.dangerInk, strike: true },
  NO_SHOW: { bg: colors.bg, border: colors.mist, fg: colors.muted },
};
const CLASS_BLOCK = { bg: colors.infoBg, border: colors.info, fg: colors.infoInk };

type Entry = { kind: 'appt'; a: AppointmentDTO } | { kind: 'class'; c: ClassSessionDTO };
type Placed = Entry & { start: number; end: number; lane: number; lanes: number };

/** Çakışan blokları yan yana şeritlere yerleştir (web ile aynı algoritma) */
function layout(items: AppointmentDTO[], classes: ClassSessionDTO[] = []): Placed[] {
  const sorted = [
    ...items
      .filter((a) => a.time && a.durationMinutes)
      .map((a) => ({ kind: 'appt' as const, a, start: minutesOf(a.time!), end: minutesOf(a.time!) + a.durationMinutes! })),
    ...classes.map((c) => ({ kind: 'class' as const, c, start: minutesOf(c.time), end: minutesOf(c.time) + c.durationMinutes })),
  ].sort((x, y) => x.start - y.start || y.end - x.end);
  const out: Placed[] = [];
  let cluster: Placed[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const lanes = Math.max(1, ...cluster.map((c) => c.lane + 1));
    cluster.forEach((c) => (c.lanes = lanes));
    out.push(...cluster);
    cluster = [];
  };
  for (const s of sorted) {
    if (s.start >= clusterEnd && cluster.length) flush();
    const used = new Set(cluster.filter((c) => c.end > s.start).map((c) => c.lane));
    let lane = 0;
    while (used.has(lane)) lane++;
    cluster.push({ ...s, lane, lanes: 1 } as Placed);
    clusterEnd = Math.max(clusterEnd, s.end);
  }
  if (cluster.length) flush();
  return out;
}

/** Sürükleme sırasında tüm bloklarca paylaşılan ızgara durumu */
interface GridCtx {
  scrollRef: AnimatedRef<RNScrollView>;
  scrollY: SharedValue<number>;
  dragScroll: SharedValue<number>;
  autoSpeed: SharedValue<number>;
  colW: SharedValue<number>;
  startH: number;
  endH: number;
  days: string[];
  plans: Map<string, DayPlanDTO>;
  onLift: (date: string) => void;
  onDragEnd: () => void;
  onLand: () => void;
}

export function TimeGrid({
  days,
  data,
  showCancelled,
  canWrite,
  refreshing,
  onRefresh,
  onOpen,
  onOpenClass,
  onCreate,
  onMove,
  onPickDay,
}: {
  days: string[];
  data: RangeData;
  showCancelled: boolean;
  canWrite: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  onOpen: (id: string) => void;
  onOpenClass: (id: string) => void;
  onCreate: (date: string, time: string) => void;
  /** Onay + kayıt; true → taşındı (blok yeni yerinde kalır), false → blok geri döner */
  onMove: (a: AppointmentDTO, date: string, time: string) => Promise<boolean>;
  /** Hafta başlığındaki güne dokununca */
  onPickDay?: (date: string) => void;
}) {
  const items = useMemo(() => data.items.filter((a) => showCancelled || (a.status !== 'CANCELLED' && a.status !== 'NO_SHOW')), [data.items, showCancelled]);
  const classes = useMemo(() => data.classes.filter((c) => showCancelled || c.status !== 'CANCELLED'), [data.classes, showCancelled]);
  const plans = data.plans;
  const single = days.length === 1;

  // Görünür saat aralığı: 08–20; çalışma pencereleri/randevular daha geniş ise genişlet (web ile aynı)
  const [startH, endH] = useMemo(() => {
    let s = 8;
    let e = 20;
    for (const p of plans.values()) for (const w of p.windows) { s = Math.min(s, Math.floor(w.start / 60)); e = Math.max(e, Math.ceil(w.end / 60)); }
    for (const a of items) if (a.time && a.durationMinutes) { const st = minutesOf(a.time); s = Math.min(s, Math.floor(st / 60)); e = Math.max(e, Math.ceil((st + a.durationMinutes) / 60)); }
    for (const c of classes) { const st = minutesOf(c.time); s = Math.min(s, Math.floor(st / 60)); e = Math.max(e, Math.ceil((st + c.durationMinutes) / 60)); }
    return [Math.max(0, s), Math.min(24, e)];
  }, [plans, items, classes]);
  const hours = Array.from({ length: endH - startH }, (_, i) => startH + i);
  const gridH = hours.length * HOUR_PX;
  const y = (min: number) => ((min - startH * 60) / 60) * HOUR_PX;

  const placedByDay = useMemo(() => {
    const m = new Map<string, Placed[]>();
    for (const d of days) m.set(d, layout(items.filter((a) => a.date === d), classes.filter((c) => c.date === d)));
    return m;
  }, [days, items, classes]);

  // Şimdi çizgisi (dakikada bir güncellenir)
  const [now, setNow] = useState(() => DateTime.now().setZone(TIME_ZONE));
  useEffect(() => {
    const t = setInterval(() => setNow(DateTime.now().setZone(TIME_ZONE)), 60_000);
    return () => clearInterval(t);
  }, []);
  const today = now.toISODate()!;
  const nowMin = now.hour * 60 + now.minute;

  // ── Kaydırma + sürükleme durumu ──
  const scrollRef = useAnimatedRef<RNScrollView>();
  const scrollY = useScrollOffset(scrollRef);
  const dragScroll = useSharedValue(0);
  const autoSpeed = useSharedValue(0);
  const maxScroll = useSharedValue(0);
  const colW = useSharedValue(0);
  const sizes = useRef({ viewport: 0, content: 0 });
  const updateMax = () => (maxScroll.value = Math.max(0, sizes.current.content - sizes.current.viewport));

  // Kenara yaklaşınca otomatik kaydırma (yalnızca sürükleme sırasında çalışır)
  const autoScroll = useFrameCallback(() => {
    'worklet';
    const s = autoSpeed.value;
    if (s === 0) return;
    const next = Math.max(0, Math.min(maxScroll.value, dragScroll.value + s));
    if (next !== dragScroll.value) {
      dragScroll.value = next;
      scrollTo(scrollRef, 0, next, false);
    }
  }, false);

  const [raisedDay, setRaisedDay] = useState<string | null>(null);
  const onLift = useCallback(
    (date: string) => {
      setRaisedDay(date);
      autoScroll.setActive(true);
    },
    [autoScroll],
  );
  const onDragEnd = useCallback(() => autoScroll.setActive(false), [autoScroll]);
  const onLand = useCallback(() => setRaisedDay(null), []);
  // Yeni veri gelince (taşıma kaydedildi) sütun katmanını normale döndür
  useEffect(() => setRaisedDay(null), [data]);

  const ctx: GridCtx = { scrollRef, scrollY, dragScroll, autoSpeed, colW, startH, endH, days, plans, onLift, onDragEnd, onLand };

  // İlk açılışta: bugün görünüyorsa şimdiden 1 saat öncesine, değilse mesai başlangıcına kaydır (web ile aynı)
  const daysKey = days.join(',');
  useEffect(() => {
    const first = [...plans.values()].flatMap((p) => p.windows).map((w) => w.start).sort((a, b) => a - b)[0];
    const target = days.includes(today) && nowMin > startH * 60 ? nowMin - 60 : first ?? 9 * 60;
    const t = setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(0, y(target) - 16), animated: false }), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daysKey, startH]);

  const empty = items.length === 0 && classes.length === 0;
  const plan0 = single ? plans.get(days[0]!) : undefined;

  return (
    <View style={styles.wrap}>
      {/* Gün başlıkları */}
      <View style={styles.headRow}>
        <View style={{ width: AXIS_W }} />
        {days.map((d) => {
          const dt = DateTime.fromISO(d, { zone: TIME_ZONE });
          const p = plans.get(d);
          const isToday = d === today;
          const closed = p && !p.isWorking;
          const body = (
            <>
              <T style={styles.headDow}>{dt.toFormat('ccc')}</T>
              <View style={[styles.headNum, isToday && { backgroundColor: colors.espresso }]}>
                <T style={{ fontFamily: fonts.bold, fontSize: 14, color: isToday ? colors.cream : colors.text }}>{dt.day}</T>
              </View>
              {!single && closed ? <T style={styles.headClosed} numberOfLines={1}>Kapalı</T> : null}
            </>
          );
          return single ? (
            <View key={d} style={[styles.headCell, { flexDirection: 'row', gap: space.sm, justifyContent: 'flex-start', paddingHorizontal: space.sm }]}>
              {body}
              <T variant="caption" numberOfLines={1} style={{ flex: 1 }}>
                {plan0?.isWorking ? `Çalışma: ${plan0.windows.map((w) => `${timeOf(w.start)}–${timeOf(w.end)}`).join(', ')}` : plan0?.closedReason ?? 'Kapalı'}
              </T>
            </View>
          ) : (
            <HeaderTap
              key={d}
              label={`${dt.toFormat('d MMMM cccc')}${closed ? `, ${p?.closedReason ?? 'kapalı'}` : ''}, gün görünümünü aç`}
              onPress={() => onPickDay?.(d)}
            >
              {body}
            </HeaderTap>
          );
        })}
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: TOP_PAD, paddingBottom: canWrite ? 104 : 24 }}
        scrollEventThrottle={16}
        onLayout={(e) => {
          sizes.current.viewport = e.nativeEvent.layout.height;
          updateMax();
        }}
        onContentSizeChange={(_, h) => {
          sizes.current.content = h;
          updateMax();
        }}
        refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.gold} colors={[colors.gold]} /> : undefined}
      >
        <View style={{ flexDirection: 'row', height: gridH }}>
          {/* Saat ekseni */}
          <View style={{ width: AXIS_W }}>
            {hours.map((h) => (
              <T key={h} style={[styles.axisLabel, { top: y(h * 60) - 7 }]}>{`${String(h).padStart(2, '0')}:00`}</T>
            ))}
          </View>
          {days.map((d, i) => (
            <DayColumn
              key={d}
              date={d}
              dayIdx={i}
              plan={plans.get(d)}
              placed={placedByDay.get(d) ?? []}
              hours={hours}
              gridH={gridH}
              raised={raisedDay === d}
              nowMin={d === today && nowMin >= startH * 60 && nowMin <= endH * 60 ? nowMin : null}
              canWrite={canWrite}
              ctx={ctx}
              onOpen={onOpen}
              onOpenClass={onOpenClass}
              onCreate={onCreate}
              onMove={onMove}
              onLayoutWidth={i === 0 ? (w) => (colW.value = w) : undefined}
            />
          ))}
        </View>
      </ScrollView>

      {empty || canWrite ? (
        <View style={styles.foot}>
          <T variant="caption" center>
            {empty ? (single ? 'Bu gün için randevu bulunmuyor. ' : 'Bu hafta için randevu bulunmuyor. ') : ''}
            {canWrite ? 'Taşımak için randevuya basılı tutup sürükleyin; boş saate basılı tutarak randevu ekleyin.' : ''}
          </T>
        </View>
      ) : null}
    </View>
  );
}

/** Hafta başlığındaki gün hücresi — dokununca gün görünümü */
function HeaderTap({ label, onPress, children }: { label: string; onPress: () => void; children: ReactNode }) {
  const tap = useTapGesture({
    onActivate: () => {
      'worklet';
      scheduleOnRN(onPress);
    },
  });
  return (
    <GestureDetector gesture={tap}>
      <View style={styles.headCell} accessible accessibilityRole="button" accessibilityLabel={label} accessibilityActions={[{ name: 'activate' }]} onAccessibilityAction={onPress}>
        {children}
      </View>
    </GestureDetector>
  );
}

function DayColumn({
  date,
  dayIdx,
  plan,
  placed,
  hours,
  gridH,
  raised,
  nowMin,
  canWrite,
  ctx,
  onOpen,
  onOpenClass,
  onCreate,
  onMove,
  onLayoutWidth,
}: {
  date: string;
  dayIdx: number;
  plan: DayPlanDTO | undefined;
  placed: Placed[];
  hours: number[];
  gridH: number;
  raised: boolean;
  nowMin: number | null;
  canWrite: boolean;
  ctx: GridCtx;
  onOpen: (id: string) => void;
  onOpenClass: (id: string) => void;
  onCreate: (date: string, time: string) => void;
  onMove: (a: AppointmentDTO, date: string, time: string) => Promise<boolean>;
  onLayoutWidth?: (w: number) => void;
}) {
  const { startH } = ctx;
  const y = (min: number) => ((min - startH * 60) / 60) * HOUR_PX;

  // Boş alana basılı tutma → o saate yeni randevu (web: boş alana tıklama, 15 dk'ya aşağı yuvarlanır)
  const createAt = (py: number) => {
    const raw = (py / HOUR_PX) * 60 + startH * 60;
    if (placed.some((p) => raw >= p.start && raw < p.end)) return; // bloğun üstü
    const min = Math.floor(raw / SNAP) * SNAP;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onCreate(date, timeOf(min));
  };
  const press = useLongPressGesture({
    enabled: canWrite,
    minDuration: CREATE_MS,
    onActivate: (e) => {
      'worklet';
      scheduleOnRN(createAt, e.y);
    },
  });

  return (
    <GestureDetector gesture={press}>
      <View
        style={[styles.col, { height: gridH }, raised && { zIndex: 20 }]}
        onLayout={onLayoutWidth ? (e) => onLayoutWidth(e.nativeEvent.layout.width) : undefined}
      >
        {/* Çalışma pencereleri */}
        {plan?.windows.map((w) => (
          <View key={w.start} pointerEvents="none" style={[styles.window, { top: y(w.start), height: y(w.end) - y(w.start) }]} />
        ))}
        {/* Saat ve yarım saat çizgileri */}
        {hours.map((h) => (
          <View key={h} pointerEvents="none" style={[styles.hourLine, { top: y(h * 60) }]} />
        ))}
        {hours.map((h) => (
          <View key={`h${h}`} pointerEvents="none" style={[styles.halfLine, { top: y(h * 60 + 30) }]} />
        ))}
        {nowMin !== null ? (
          <View pointerEvents="none" style={[styles.nowLine, { top: y(nowMin) - 1 }]}>
            <View style={styles.nowDot} />
          </View>
        ) : null}
        {placed.map((p) =>
          p.kind === 'class' ? (
            <ClassBlock key={`c-${p.c.id}`} p={p} y={y} onPress={() => onOpenClass(p.c.id)} />
          ) : (
            <AppointmentBlock
              key={p.a.id}
              p={p as Placed & { kind: 'appt' }}
              dayIdx={dayIdx}
              draggable={canWrite && DRAGGABLE.has(p.a.status)}
              ctx={ctx}
              onOpen={onOpen}
              onMove={onMove}
            />
          ),
        )}
      </View>
    </GestureDetector>
  );
}

function boxOf(p: Placed) {
  return { left: `${(p.lane / p.lanes) * 100}%` as const, width: `${100 / p.lanes}%` as const };
}

function ClassBlock({ p, y, onPress }: { p: Placed & { kind: 'class' }; y: (m: number) => number; onPress: () => void }) {
  const c = p.c;
  const h = Math.max(MIN_BLOCK, y(p.end) - y(p.start) - 2);
  const cancelled = c.status === 'CANCELLED';
  const tap = useTapGesture({
    onActivate: () => {
      'worklet';
      scheduleOnRN(onPress);
    },
  });
  return (
    <GestureDetector gesture={tap}>
      <View
        style={[styles.slot, boxOf(p), { top: y(p.start) + 1, height: h }]}
        accessible
        accessibilityRole="button"
        accessibilityLabel={`Pilates: ${c.groupName ?? c.title}, ${c.time}, ${c.seatsTaken}/${c.capacity} kişi${cancelled ? ', iptal' : ''}`}
        accessibilityActions={[{ name: 'activate' }]}
        onAccessibilityAction={onPress}
      >
        <View style={[styles.block, { backgroundColor: CLASS_BLOCK.bg, borderLeftColor: CLASS_BLOCK.border }, cancelled && { opacity: 0.6 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Icon name="activity" size={10} color={CLASS_BLOCK.fg} />
            <T style={[styles.blockTitle, { color: CLASS_BLOCK.fg, flex: 1 }, cancelled && styles.strike]} numberOfLines={1}>{c.groupName ?? c.title}</T>
          </View>
          {h > 34 ? (
            <T style={[styles.blockSub, { color: CLASS_BLOCK.fg }]} numberOfLines={1}>
              {c.time}–{timeOf(minutesOf(c.time) + c.durationMinutes)} · {c.seatsTaken}/{c.capacity}
            </T>
          ) : null}
        </View>
      </View>
    </GestureDetector>
  );
}

type DragLabel = { min: number; day: number; below: boolean };

function AppointmentBlock({
  p,
  dayIdx,
  draggable,
  ctx,
  onOpen,
  onMove,
}: {
  p: Placed & { kind: 'appt' };
  dayIdx: number;
  draggable: boolean;
  ctx: GridCtx;
  onOpen: (id: string) => void;
  onMove: (a: AppointmentDTO, date: string, time: string) => Promise<boolean>;
}) {
  const a = p.a;
  const { scrollRef, scrollY, dragScroll, autoSpeed, colW, startH, endH, days, plans } = ctx;
  const nDays = days.length;
  const origMin = p.start;
  const origDay = dayIdx;
  const dur = p.end - p.start;
  const minStart = startH * 60;
  const maxStart = endH * 60 - SNAP;
  const yOf = (min: number) => {
    'worklet';
    return ((min - startH * 60) / 60) * HOUR_PX;
  };
  const h = Math.max(MIN_BLOCK, yOf(p.end) - yOf(p.start) - 2);
  const c = BLOCK[a.status];

  // Gösterilen hedef konum (bırakıldıktan sonra kayıt bitene kadar yeni yerinde kalır)
  const tMin = useSharedValue(origMin);
  const tDay = useSharedValue(origDay);
  const dragging = useSharedValue(0);
  const fx = useSharedValue(0);
  const fy = useSharedValue(0);
  const startScroll = useSharedValue(0);
  const pageY = useSharedValue(0);
  const viewH = useSharedValue(0);

  const [label, setLabel] = useState<DragLabel | null>(null);
  const [saving, setSaving] = useState(false);
  const lastTarget = useRef<string>('');

  // Veri yenilenince (taşındı ya da başka değişiklik) konumu sunucudaki değerle eşitle
  useEffect(() => {
    tMin.value = origMin;
    tDay.value = origDay;
    setSaving(false);
    setLabel(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a, origMin, origDay]);

  const goBack = () => {
    tMin.value = origMin;
    tDay.value = origDay;
  };

  // ── JS tarafı geri çağrılar ──
  const onLiftJS = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    lastTarget.current = `${origDay}-${origMin}`;
    setLabel({ min: origMin, day: origDay, below: yOf(origMin) < 34 });
    ctx.onLift(days[origDay]!);
  };
  const onTargetJS = (min: number, day: number) => {
    const key = `${day}-${min}`;
    if (key === lastTarget.current) return;
    lastTarget.current = key;
    void Haptics.selectionAsync().catch(() => {});
    setLabel({ min, day, below: yOf(min) < 34 });
  };
  const onCancelJS = () => {
    ctx.onDragEnd();
    ctx.onLand();
    setLabel(null);
  };
  const onDropJS = async (min: number, day: number) => {
    ctx.onDragEnd();
    if (min === origMin && day === origDay) {
      setLabel(null);
      ctx.onLand();
      return;
    }
    setSaving(true);
    const ok = await onMove(a, days[day]!, timeOf(min));
    if (!ok) {
      goBack();
      setSaving(false);
      setLabel(null);
      ctx.onLand();
    }
    // Başarılı: blok yeni yerinde kalır; sorgu yenilenince gerçek konumuyla yeniden çizilir
  };

  const pan = usePanGesture({
    enabled: draggable && !saving,
    activateAfterLongPress: LIFT_MS,
    onActivate: () => {
      'worklet';
      const m = measure(scrollRef);
      pageY.value = m ? m.pageY : 0;
      viewH.value = m ? m.height : 0;
      startScroll.value = scrollY.value;
      dragScroll.value = scrollY.value;
      fx.value = 0;
      fy.value = 0;
      dragging.value = 1;
      scheduleOnRN(onLiftJS);
    },
    onUpdate: (e) => {
      'worklet';
      fx.value = e.translationX;
      fy.value = e.translationY;
      // Kenara yaklaşınca otomatik kaydırma hızı
      const local = e.absoluteY - pageY.value;
      let s = 0;
      if (viewH.value > EDGE * 2) {
        if (local < EDGE) s = -MAX_SPEED * Math.min(1, (EDGE - local) / EDGE);
        else if (local > viewH.value - EDGE) s = MAX_SPEED * Math.min(1, (local - (viewH.value - EDGE)) / EDGE);
      }
      autoSpeed.value = s;
    },
    onDeactivate: (e) => {
      'worklet';
      if (!dragging.value) return;
      dragging.value = 0;
      autoSpeed.value = 0;
      if (e.canceled) {
        tMin.value = origMin;
        tDay.value = origDay;
        scheduleOnRN(onCancelJS);
      } else {
        scheduleOnRN(onDropJS, tMin.value, tDay.value);
      }
    },
    onFinalize: () => {
      'worklet';
      if (!dragging.value) return;
      dragging.value = 0;
      autoSpeed.value = 0;
      tMin.value = origMin;
      tDay.value = origDay;
      scheduleOnRN(onCancelJS);
    },
  });

  const tap = useTapGesture({
    onActivate: () => {
      'worklet';
      scheduleOnRN(onOpen, a.id);
    },
  });
  const gesture = useCompetingGestures(pan, tap);

  // Parmak + kaydırma farkından yakalanmış hedef (15 dk / gün sütunu)
  useAnimatedReaction(
    () => {
      if (!dragging.value) return -1;
      const dy = fy.value + dragScroll.value - startScroll.value;
      const raw = origMin + (dy / HOUR_PX) * 60;
      const m = Math.max(minStart, Math.min(Math.round(raw / SNAP) * SNAP, maxStart));
      let d = origDay;
      if (nDays > 1 && colW.value > 0) d = Math.max(0, Math.min(nDays - 1, origDay + Math.round(fx.value / colW.value)));
      return d * 10000 + m;
    },
    (cur, prev) => {
      if (cur < 0 || cur === prev) return;
      const d = Math.floor(cur / 10000);
      const m = cur % 10000;
      tMin.value = m;
      tDay.value = d;
      scheduleOnRN(onTargetJS, m, d);
    },
  );

  const animStyle = useAnimatedStyle(() => {
    const lifted = dragging.value === 1;
    return {
      top: withTiming(yOf(tMin.value) + 1, { duration: 110 }),
      transform: [
        { translateX: withTiming((tDay.value - origDay) * colW.value, { duration: 110 }) },
        { scale: withTiming(lifted ? 1.04 : 1, { duration: 120 }) },
      ],
      zIndex: lifted ? 50 : 1,
      shadowOpacity: lifted ? 0.25 : 0,
      elevation: lifted ? 8 : 0,
    };
  });

  const a11yOpen = (e: AccessibilityActionEvent) => {
    if (e.nativeEvent.actionName === 'activate') onOpen(a.id);
  };

  // Hedef etiketinin uyarıları (son kararı sunucu verir)
  let warn: string | null = null;
  if (label) {
    const d = days[label.day]!;
    const pl = plans.get(d);
    const end = label.min + dur;
    if (DateTime.fromISO(`${d}T${timeOf(label.min)}`, { zone: TIME_ZONE }) < DateTime.now()) warn = 'Geçmiş saat';
    else if (!pl?.isWorking || !pl.windows.some((w) => label.min >= w.start && end <= w.end)) warn = 'Çalışma saati dışı';
  }
  const labelRight = nDays > 1 && (label?.day ?? origDay) >= 4;

  return (
    <>
      {label ? <View pointerEvents="none" style={[styles.slot, boxOf(p), { top: yOf(origMin) + 1, height: h }, styles.ghost]} /> : null}
      <GestureDetector gesture={gesture}>
        <Animated.View
          style={[styles.slot, boxOf(p), { height: h, shadowColor: '#302219', shadowRadius: 10, shadowOffset: { width: 0, height: 4 } }, animStyle]}
          accessible
          accessibilityRole="button"
          accessibilityLabel={`${displayName(a)}, ${a.time}–${timeOf(origMin + dur)}, ${APPOINTMENT_STATUS_LABEL[a.status]}`}
          accessibilityHint="Ayrıntıları açar. Saati değiştirmek için randevu ayrıntısındaki Tarihi / saati değiştir'i kullanın."
          accessibilityActions={[{ name: 'activate' }]}
          onAccessibilityAction={a11yOpen}
        >
          <View style={[styles.block, { backgroundColor: c.bg, borderLeftColor: c.border }, saving && { opacity: 0.7 }]}>
            <T style={[styles.blockTitle, { color: c.fg }, c.strike && styles.strike]} numberOfLines={Math.max(1, Math.floor((h - 6) / 13) - (h > 34 ? 1 : 0))}>
              {displayName(a)}
            </T>
            {h > 34 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                {nDays === 1 ? <Icon name={a.meetingType === 'ONLINE' ? 'video' : 'map-pin'} size={10} color={c.fg} /> : null}
                <T style={[styles.blockSub, { color: c.fg }]} numberOfLines={1}>
                  {nDays === 1 ? `${a.time}–${timeOf(origMin + dur)}` : a.time}
                </T>
              </View>
            ) : null}
          </View>
          {label ? (
            <View pointerEvents="none" style={[styles.dragLabel, label.below ? { top: h + 6 } : { bottom: h + 6 }, labelRight ? { right: 0 } : { left: 0 }]}>
              <T style={styles.dragTime}>
                {timeOf(label.min)}–{timeOf(label.min + dur)}
                {nDays > 1 ? ` · ${DateTime.fromISO(days[label.day]!, { zone: TIME_ZONE }).toFormat('ccc d')}` : ''}
              </T>
              {warn ? <T style={styles.dragWarn}>{warn}</T> : null}
            </View>
          ) : null}
        </Animated.View>
      </GestureDetector>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, overflow: 'hidden' },
  headRow: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line, backgroundColor: colors.surface },
  headCell: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 6, minHeight: 44 },
  headDow: { fontFamily: fonts.semibold, fontSize: 10.5, color: colors.muted, textTransform: 'uppercase' },
  headNum: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  headClosed: { fontSize: 9, color: colors.muted },
  axisLabel: { position: 'absolute', right: 5, fontSize: 10, color: colors.muted, fontVariant: ['tabular-nums'] },
  col: { flex: 1, backgroundColor: '#F3EEE6', borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.line },
  window: { position: 'absolute', left: 0, right: 0, backgroundColor: colors.surface },
  hourLine: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
  halfLine: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: '#F1ECE4' },
  nowLine: { position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: colors.danger, zIndex: 30 },
  nowDot: { position: 'absolute', left: -3, top: -3, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger },
  slot: { position: 'absolute', paddingHorizontal: 1.5 },
  block: { flex: 1, borderRadius: 6, borderLeftWidth: 3, paddingHorizontal: 4, paddingVertical: 3, overflow: 'hidden' },
  blockTitle: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 13 },
  blockSub: { fontFamily: fonts.medium, fontSize: 10, lineHeight: 12, fontVariant: ['tabular-nums'] },
  strike: { textDecorationLine: 'line-through' },
  ghost: { borderRadius: 6, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.cocoa, backgroundColor: 'rgba(48,34,25,0.05)' },
  dragLabel: { position: 'absolute', width: 132, paddingHorizontal: 8, paddingVertical: 5, borderRadius: radius.sm, backgroundColor: colors.espresso, zIndex: 60 },
  dragTime: { fontFamily: fonts.bold, fontSize: 12, color: colors.cream, fontVariant: ['tabular-nums'] },
  dragWarn: { fontFamily: fonts.semibold, fontSize: 10.5, color: colors.rose },
  foot: { paddingHorizontal: space.md, paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
});
