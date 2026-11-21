// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Çevreleyen kaydırma görünümüne UI iş parçacığından erişim (Sortable'ın kenarda otomatik kaydırması için).
 * `Screen` ve `Sheet` sağlar; sağlayıcı yoksa `useScrollHost()` null döner ve sürükleme kaydırmasız çalışır.
 * Yaklaşım takvimdeki sürüklemeyle aynıdır (features/appointments/TimeGrid.tsx).
 */
import { createContext, useContext, useRef } from 'react';
import type { LayoutChangeEvent, ScrollView as RNScrollView } from 'react-native';
import { useAnimatedRef, useScrollOffset, useSharedValue, type AnimatedRef, type SharedValue } from 'react-native-reanimated';

export interface ScrollHost {
  /** Kaydırma görünümünün animasyonlu ref'i (scrollTo / measure) */
  ref: AnimatedRef<RNScrollView>;
  /** Güncel dikey kaydırma konumu */
  offset: SharedValue<number>;
  /** En büyük kaydırma konumu (içerik − görünür alan) */
  max: SharedValue<number>;
}

const ScrollContext = createContext<ScrollHost | null>(null);
export const ScrollHostProvider = ScrollContext.Provider;

export function useScrollHost() {
  return useContext(ScrollContext);
}

/** Kaydırma görünümüne verilecek ref + boyut izleyicileri ve bağlam değeri */
export function useScrollHostSetup() {
  const ref = useAnimatedRef<RNScrollView>();
  const offset = useScrollOffset(ref);
  const max = useSharedValue(0);
  const sizes = useRef({ viewport: 0, content: 0 });
  const update = () => (max.value = Math.max(0, sizes.current.content - sizes.current.viewport));
  const host = useRef<ScrollHost>({ ref, offset, max }).current;
  return {
    host,
    scrollProps: {
      ref,
      scrollEventThrottle: 16,
      onLayout: (e: LayoutChangeEvent) => {
        sizes.current.viewport = e.nativeEvent.layout.height;
        update();
      },
      onContentSizeChange: (_w: number, h: number) => {
        sizes.current.content = h;
        update();
      },
    },
  };
}
