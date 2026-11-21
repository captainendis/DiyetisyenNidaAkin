// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// Hareket yöneticisiyle uyumlu kaydırma: içindeki sürükleme (Sortable) başlayınca kaydırma durur
import { ScrollView } from 'react-native-gesture-handler';
import { colors, radius, shadow, space } from '@/theme';
import { Icon, type IconName } from './Icon';
import { ScrollHostProvider, useScrollHostSetup } from './ScrollContext';
import { T } from './Text';

/**
 * Ekran kabı: kaydırılabilir içerik + çekip-yenile + klavye kaçınma.
 * Başlık, Stack başlığından gelir (Stack.Screen options); büyük başlık gerekirse `title` verilir.
 */
export function Screen({
  children,
  refreshing,
  onRefresh,
  scroll = true,
  padded = true,
  title,
  subtitle,
  footer,
  contentStyle,
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  scroll?: boolean;
  padded?: boolean;
  title?: string;
  subtitle?: string;
  /** Altta sabit alan (ör. Kaydet butonu) */
  footer?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  // İçerideki sürükle-sırala (Sortable) kenara gelince bu görünümü kaydırabilsin
  const { host, scrollProps } = useScrollHostSetup();
  const head = title ? (
    <View style={{ marginBottom: space.lg, gap: 4 }}>
      <T variant="display">{title}</T>
      {subtitle ? <T muted>{subtitle}</T> : null}
    </View>
  ) : null;
  const pad = padded ? { padding: space.lg } : null;
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
      <View style={[styles.flex, { backgroundColor: colors.bg }]}>
        {scroll ? (
          <ScrollHostProvider value={host}>
            <ScrollView
              {...scrollProps}
              style={styles.flex}
              contentContainerStyle={[pad, { paddingBottom: (footer ? space.lg : insets.bottom + space.xxl) }, contentStyle]}
              keyboardShouldPersistTaps="handled"
              contentInsetAdjustmentBehavior="automatic"
              refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.gold} colors={[colors.gold]} /> : undefined}
            >
              {head}
              {children}
            </ScrollView>
          </ScrollHostProvider>
        ) : (
          <View style={[styles.flex, pad, contentStyle]}>
            {head}
            {children}
          </View>
        )}
        {footer ? <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space.md) }]}>{footer}</View> : null}
      </View>
    </KeyboardAvoidingView>
  );
}

/** Beyaz yüzeyli kart */
export function Card({ children, style, onPress, padded = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; padded?: boolean }) {
  const inner = [styles.card, padded && { padding: space.lg }, style];
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [...inner, pressed && { opacity: 0.85 }]} accessibilityRole="button">
        {children}
      </Pressable>
    );
  }
  return <View style={inner}>{children}</View>;
}

/** Başlıklı bölüm */
export function Section({ title, action, children, style }: { title?: string; action?: ReactNode; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ marginBottom: space.xl }, style]}>
      {title || action ? (
        <View style={styles.sectionHead}>
          {title ? <T variant="overline" style={{ flexShrink: 1 }}>{title}</T> : <View />}
          {action}
        </View>
      ) : null}
      {children}
    </View>
  );
}

/**
 * Liste satırı (kart içinde art arda kullanılır). `onPress` verilirse ok işareti gösterilir.
 */
export function ListItem({
  title,
  subtitle,
  meta,
  icon,
  left,
  right,
  onPress,
  last,
  danger,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  icon?: IconName;
  left?: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
  last?: boolean;
  danger?: boolean;
}) {
  const content = (
    <View style={[styles.row, !last && styles.rowLine]}>
      {left ?? (icon ? <View style={styles.rowIcon}><Icon name={icon} size={18} color={danger ? colors.dangerInk : colors.goldInk} /></View> : null)}
      <View style={{ flex: 1, gap: 2 }}>
        {typeof title === 'string' ? <T variant="subheading" color={danger ? colors.dangerInk : undefined} numberOfLines={2}>{title}</T> : title}
        {subtitle ? typeof subtitle === 'string' ? <T variant="caption" numberOfLines={2}>{subtitle}</T> : subtitle : null}
      </View>
      {meta ? typeof meta === 'string' ? <T variant="caption">{meta}</T> : meta : null}
      {right}
      {onPress ? <Icon name="chevron-right" size={18} color={colors.mist} /> : null}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => pressed && { backgroundColor: '#F8F4EE' }}>
      {content}
    </Pressable>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: colors.line, marginVertical: space.md }, style]} />;
}

export function RowBetween({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md }, style]}>{children}</View>;
}

/** Etiket–değer satırı (detay ekranlarında) */
export function KeyValue({ label, value, last }: { label: string; value: ReactNode; last?: boolean }) {
  return (
    <View style={[styles.kv, !last && styles.rowLine]}>
      <T variant="caption" style={{ flex: 1 }}>{label}</T>
      <View style={{ flex: 1.6, alignItems: 'flex-end' }}>{typeof value === 'string' || typeof value === 'number' ? <T variant="body" style={{ textAlign: 'right' }}>{value || '—'}</T> : (value ?? <T>—</T>)}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, ...shadow.card },
  // Dar ekranda uzun başlık + eylem düğmesi çakışmasın: başlık sarar, araya boşluk girer
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm, marginBottom: space.sm, paddingHorizontal: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 14, paddingHorizontal: space.lg },
  rowLine: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  rowIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#F4EEE5', alignItems: 'center', justifyContent: 'center' },
  kv: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10, gap: space.md },
  footer: { paddingHorizontal: space.lg, paddingTop: space.md, backgroundColor: colors.bg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
});
