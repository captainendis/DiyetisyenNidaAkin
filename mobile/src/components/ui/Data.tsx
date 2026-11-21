// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius, shadow, space } from '@/theme';
import { initials } from '@/lib/text';
import { ErrorView, Loading } from './Feedback';
import { Icon, type IconName } from './Icon';
import { T } from './Text';

/**
 * Sorgu sonucu: yükleniyor / hata / veri. `useApiQuery` sonucuyla:
 *   <QueryView query={q}>{(data) => …}</QueryView>
 */
export function QueryView<T>({
  query,
  children,
}: {
  query: { data: T | undefined; error: unknown; isPending: boolean; refetch: () => unknown };
  children: (data: T) => ReactNode;
}) {
  if (query.isPending) return <Loading />;
  if (query.error || query.data === undefined) return <ErrorView error={query.error} onRetry={() => void query.refetch()} />;
  return <>{children(query.data)}</>;
}

export function Avatar({ name, size = 40, tone = 'sand' }: { name: string; size?: number; tone?: 'sand' | 'dark' }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: tone === 'dark' ? colors.espresso : colors.sand, alignItems: 'center', justifyContent: 'center' }}>
      <T style={{ fontFamily: fonts.semibold, fontSize: size * 0.36, color: tone === 'dark' ? colors.cream : colors.cocoa }}>{initials(name)}</T>
    </View>
  );
}

/** Sayı kutusu (genel bakış) */
export function StatTile({ label, value, hint, icon, onPress, style }: { label: string; value: ReactNode; hint?: string; icon?: IconName; onPress?: () => void; style?: StyleProp<ViewStyle> }) {
  const body = (
    <View style={[styles.stat, style]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <T variant="caption" numberOfLines={1} style={{ flex: 1 }}>{label}</T>
        {icon ? <Icon name={icon} size={16} color={colors.goldInk} /> : null}
      </View>
      <T style={{ fontFamily: fonts.display, fontSize: 30, lineHeight: 34, color: colors.text }}>{value}</T>
      {hint ? <T variant="caption" numberOfLines={2}>{hint}</T> : null}
    </View>
  );
  return onPress ? <Pressable onPress={onPress} style={({ pressed }) => [{ flex: 1 }, pressed && { opacity: 0.8 }]} accessibilityRole="button">{body}</Pressable> : <View style={{ flex: 1 }}>{body}</View>;
}

/** İki sütunlu ızgara */
export function Grid({ children, gap = space.md }: { children: ReactNode[]; gap?: number }) {
  const rows: ReactNode[][] = [];
  children.filter(Boolean).forEach((c, i) => {
    if (i % 2 === 0) rows.push([c]);
    else rows[rows.length - 1]!.push(c);
  });
  return (
    <View style={{ gap }}>
      {rows.map((r, i) => (
        <View key={i} style={{ flexDirection: 'row', gap }}>
          {r}
          {r.length === 1 ? <View style={{ flex: 1 }} /> : null}
        </View>
      ))}
    </View>
  );
}

/** Sağ altta yüzen ekle butonu */
export function Fab({ icon = 'plus', label, onPress }: { icon?: IconName; label: string; onPress: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.fab, { bottom: insets.bottom + space.lg }, pressed && { opacity: 0.85 }]}
    >
      <Icon name={icon} size={20} color={colors.cream} />
      <T style={{ color: colors.cream, fontFamily: fonts.semibold }}>{label}</T>
    </Pressable>
  );
}

/** Basit çubuk (yüzde, ilerleme) */
export function ProgressBar({ value, color = colors.gold }: { value: number; color?: string }) {
  return (
    <View style={{ height: 8, borderRadius: 4, backgroundColor: '#EDE6DB', overflow: 'hidden' }}>
      <View style={{ width: `${Math.max(0, Math.min(100, value))}%`, height: '100%', backgroundColor: color, borderRadius: 4 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  stat: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, gap: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, ...shadow.card },
  fab: {
    position: 'absolute',
    right: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.espresso,
    borderRadius: radius.pill,
    paddingHorizontal: 20,
    height: 52,
    ...shadow.card,
    shadowOpacity: 0.2,
  },
});
