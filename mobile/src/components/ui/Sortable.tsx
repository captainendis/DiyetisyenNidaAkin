// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Dokun-sürükle-bırak ile sıralanabilir liste.
 *
 *   <Sortable
 *     items={items}
 *     keyOf={(x) => x.id}
 *     onReorder={(from, to) => …}
 *     renderItem={(item, index, handle) => <Row …>{handle}</Row>}
 *   />
 *
 * Satırdaki tutamaca (≡) basılı tutulunca (kısa titreşim) satır kalkar; parmakla yukarı/aşağı sürüklenir, diğer
 * satırlar yer açar, bırakınca `onReorder(from, to)` çağrılır. Satırların yüksekliği farklı olabilir.
 * Ekran okuyucu kullanıcıları için tutamaç "Yukarı taşı / Aşağı taşı" erişilebilirlik eylemleri sunar
 * (sürükleme yapamayanlar için tek alternatif budur; görsel ok düğmesi yoktur).
 *
 * `Screen` / `Sheet` içinde kullanılınca (ScrollContext) satır görünür alanın üst/alt kenarına sürüklendiğinde
 * çevreleyen liste kendiliğinden kayar (kenara yaklaştıkça hızlanır); satır parmağın altında kalır ve bırakılacak
 * sıra kaydırılan mesafeyi de hesaba katar. Yaklaşım takvim sürüklemesiyle aynıdır (TimeGrid).
 */
import * as Haptics from 'expo-haptics';
import { useCallback, useState, type ReactNode } from 'react';
import { StyleSheet, View, type AccessibilityActionEvent } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  measure,
  scrollTo,
  useAnimatedReaction,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { colors, shadow } from '@/theme';
import { Icon } from './Icon';
import { useScrollHost, type ScrollHost } from './ScrollContext';

const LONG_PRESS_MS = 180;
const SHIFT_MS = 160;
/** Otomatik kaydırma: kenar bölgesi (pt) ve kare başına en yüksek hız (TimeGrid ile aynı) */
const EDGE = 56;
const MAX_SPEED = 12;

interface Shared {
  active: SharedValue<number>;
  /** Satırın ilk yerine göre kayması = parmak kayması + sürükleme sırasında kaydırılan mesafe */
  dragY: SharedValue<number>;
  heights: SharedValue<number[]>;
  gap: number;
  /** Parmağın sürükleme başından beri dikey kayması */
  fingerY: SharedValue<number>;
  /** Kaydırma konumu: sürükleme başında / otomatik kaydırmayla güncel */
  startScroll: SharedValue<number>;
  dragScroll: SharedValue<number>;
  /** Kare başına otomatik kaydırma (−: yukarı, +: aşağı) */
  autoSpeed: SharedValue<number>;
  /** Kaydırma görünümünün ekrandaki konumu ve yüksekliği (sürükleme başında ölçülür) */
  pageY: SharedValue<number>;
  viewH: SharedValue<number>;
  host: ScrollHost | null;
  startAuto: () => void;
  stopAuto: () => void;
}

/** Sürüklenen satırın bırakılacağı hedef sıra (orta noktaları geçince yer değiştirir) */
function targetIndex(from: number, dy: number, heights: number[], gap: number) {
  'worklet';
  let to = from;
  if (dy > 0) {
    let acc = 0;
    for (let i = from + 1; i < heights.length; i++) {
      const h = (heights[i] ?? 0) + gap;
      if (dy > acc + h / 2) {
        to = i;
        acc += h;
      } else break;
    }
  } else if (dy < 0) {
    let acc = 0;
    for (let i = from - 1; i >= 0; i--) {
      const h = (heights[i] ?? 0) + gap;
      if (-dy > acc + h / 2) {
        to = i;
        acc += h;
      } else break;
    }
  }
  return to;
}

function SortableRow({
  index,
  count,
  shared,
  enabled,
  label,
  onDrop,
  children,
}: {
  index: number;
  count: number;
  shared: Shared;
  enabled: boolean;
  label: string;
  onDrop: (from: number, to: number) => void;
  children: (handle: ReactNode) => ReactNode;
}) {
  const { active, dragY, heights, gap, fingerY, startScroll, dragScroll, autoSpeed, pageY, viewH, host, startAuto, stopAuto } = shared;
  const scrollRef = host?.ref;
  const scrollOffset = host?.offset;

  const lift = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    startAuto();
  };

  const pan = usePanGesture({
    enabled,
    activateAfterLongPress: LONG_PRESS_MS,
    onActivate: () => {
      'worklet';
      let s0 = 0;
      pageY.value = 0;
      viewH.value = 0;
      if (scrollRef && scrollOffset) {
        const m = measure(scrollRef);
        if (m) {
          pageY.value = m.pageY;
          viewH.value = m.height;
        }
        s0 = scrollOffset.value;
      }
      startScroll.value = s0;
      dragScroll.value = s0;
      fingerY.value = 0;
      autoSpeed.value = 0;
      active.value = index;
      dragY.value = 0;
      scheduleOnRN(lift);
    },
    onUpdate: (e) => {
      'worklet';
      fingerY.value = e.translationY;
      dragY.value = e.translationY + dragScroll.value - startScroll.value;
      // Görünür alanın kenarına yaklaşınca otomatik kaydırma hızı
      let s = 0;
      if (viewH.value > EDGE * 2) {
        const local = e.absoluteY - pageY.value;
        if (local < EDGE) s = -MAX_SPEED * Math.min(1, (EDGE - local) / EDGE);
        else if (local > viewH.value - EDGE) s = MAX_SPEED * Math.min(1, (local - (viewH.value - EDGE)) / EDGE);
      }
      autoSpeed.value = s;
    },
    onDeactivate: () => {
      'worklet';
      autoSpeed.value = 0;
      scheduleOnRN(stopAuto);
      const to = targetIndex(index, dragY.value, heights.value, gap);
      // Hedef konuma kısa bir oturma animasyonu, ardından sıralama ana iş parçacığında uygulanır
      let land = 0;
      if (to > index) for (let i = index + 1; i <= to; i++) land += (heights.value[i] ?? 0) + gap;
      else for (let i = index - 1; i >= to; i--) land -= (heights.value[i] ?? 0) + gap;
      dragY.value = withTiming(land, { duration: 120 }, (done) => {
        if (!done) return;
        active.value = -1;
        dragY.value = 0;
        if (to !== index) scheduleOnRN(onDrop, index, to);
      });
    },
    onFinalize: (e) => {
      'worklet';
      if (active.value !== index) return;
      autoSpeed.value = 0;
      scheduleOnRN(stopAuto);
      if (e.canceled) {
        active.value = -1;
        dragY.value = withTiming(0, { duration: 120 });
      }
    },
  });

  const style = useAnimatedStyle(() => {
    const a = active.value;
    if (a === index) {
      return { transform: [{ translateY: dragY.value }, { scale: 1.02 }], zIndex: 10, opacity: 0.97, shadowOpacity: 0.18 };
    }
    if (a < 0) return { transform: [{ translateY: 0 }, { scale: 1 }], zIndex: 0, opacity: 1, shadowOpacity: 0 };
    const to = targetIndex(a, dragY.value, heights.value, gap);
    const h = (heights.value[a] ?? 0) + gap;
    let shift = 0;
    if (a < to && index > a && index <= to) shift = -h;
    else if (a > to && index >= to && index < a) shift = h;
    return { transform: [{ translateY: withTiming(shift, { duration: SHIFT_MS }) }, { scale: 1 }], zIndex: 0, opacity: 1, shadowOpacity: 0 };
  });

  const onA11y = (e: AccessibilityActionEvent) => {
    if (e.nativeEvent.actionName === 'up' && index > 0) onDrop(index, index - 1);
    if (e.nativeEvent.actionName === 'down' && index < count - 1) onDrop(index, index + 1);
  };

  const handle = enabled ? (
    <GestureDetector gesture={pan}>
      <View
        style={styles.handle}
        hitSlop={8}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={`${label}, sıralamak için basılı tutup sürükleyin`}
        accessibilityActions={[
          { name: 'up', label: 'Yukarı taşı' },
          { name: 'down', label: 'Aşağı taşı' },
        ]}
        onAccessibilityAction={onA11y}
      >
        <Icon name="menu" size={18} color={colors.muted} />
      </View>
    </GestureDetector>
  ) : null;

  return (
    <Animated.View
      style={[{ ...shadow.card, shadowOpacity: 0, elevation: 0 }, style]}
      onLayout={(e) => {
        const h = e.nativeEvent.layout.height;
        if (heights.value[index] === h) return;
        const next = heights.value.slice(0, count);
        next[index] = h;
        heights.value = next;
      }}
    >
      {children(handle)}
    </Animated.View>
  );
}

export function Sortable<T>({
  items,
  keyOf,
  renderItem,
  onReorder,
  enabled = true,
  gap = 0,
  labelOf,
}: {
  items: T[];
  keyOf: (item: T, index: number) => string;
  /** `handle`: satırın uygun yerine konacak sürükleme tutamacı (enabled=false iken null) */
  renderItem: (item: T, index: number, handle: ReactNode) => ReactNode;
  onReorder: (from: number, to: number) => void;
  enabled?: boolean;
  /** Satırlar arası boşluk (pt) — kaydırma hesabına dahil edilir */
  gap?: number;
  /** Ekran okuyucu için satır adı */
  labelOf?: (item: T, index: number) => string;
}) {
  const active = useSharedValue(-1);
  const dragY = useSharedValue(0);
  const heights = useSharedValue<number[]>([]);
  const fingerY = useSharedValue(0);
  const startScroll = useSharedValue(0);
  const dragScroll = useSharedValue(0);
  const autoSpeed = useSharedValue(0);
  const pageY = useSharedValue(0);
  const viewH = useSharedValue(0);
  const host = useScrollHost();
  const scrollRef = host?.ref;
  const maxScroll = host?.max;

  // Kenara yaklaşınca otomatik kaydırma (yalnızca sürükleme sırasında çalışır). Satır içerikle birlikte kaydığı
  // için kaydırılan mesafe dragY'ye eklenir: satır parmağın altında kalır, hedef sıra da buna göre hesaplanır.
  const autoScroll = useFrameCallback(() => {
    'worklet';
    const s = autoSpeed.value;
    if (s === 0 || !scrollRef || !maxScroll || active.value < 0) return;
    // iOS'ta otomatik içerik boşluğu nedeniyle başlangıç konumu negatif olabilir; onun altına inilmez
    const min = Math.min(0, startScroll.value);
    const next = Math.max(min, Math.min(Math.max(maxScroll.value, startScroll.value), dragScroll.value + s));
    if (next !== dragScroll.value) {
      dragScroll.value = next;
      scrollTo(scrollRef, 0, next, false);
      dragY.value = fingerY.value + next - startScroll.value;
    }
  }, false);
  const startAuto = useCallback(() => {
    if (host) autoScroll.setActive(true);
  }, [host, autoScroll]);
  const stopAuto = useCallback(() => autoScroll.setActive(false), [autoScroll]);

  const [shared] = useState<Shared>(() => ({
    active,
    dragY,
    heights,
    gap,
    fingerY,
    startScroll,
    dragScroll,
    autoSpeed,
    pageY,
    viewH,
    host,
    startAuto,
    stopAuto,
  }));

  // Hedef sıra değiştikçe kısa titreşim (parmak hareketi ya da otomatik kaydırmayla)
  const tick = () => void Haptics.selectionAsync().catch(() => {});
  useAnimatedReaction(
    () => (active.value < 0 ? -1 : targetIndex(active.value, dragY.value, heights.value, gap)),
    (cur, prev) => {
      if (cur >= 0 && prev != null && prev >= 0 && cur !== prev) scheduleOnRN(tick);
    },
  );
  return (
    <View style={{ gap }}>
      {items.map((item, i) => (
        <SortableRow
          key={keyOf(item, i)}
          index={i}
          count={items.length}
          shared={shared}
          enabled={enabled && items.length > 1}
          label={labelOf?.(item, i) ?? `${i + 1}. öğe`}
          onDrop={onReorder}
        >
          {(handle) => renderItem(item, i, handle)}
        </SortableRow>
      ))}
    </View>
  );
}

/** Diziyi yeniden sıralar (from → to) */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  const next = list.slice();
  const [x] = next.splice(from, 1);
  next.splice(to, 0, x!);
  return next;
}

const styles = StyleSheet.create({
  handle: { width: 36, height: 40, alignItems: 'center', justifyContent: 'center', marginLeft: -6 },
});
