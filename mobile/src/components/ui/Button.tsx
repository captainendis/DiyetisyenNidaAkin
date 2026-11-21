// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, fonts, radius, space } from '@/theme';
import { Icon, type IconName } from './Icon';
import { T } from './Text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'rose';

const palette: Record<Variant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.espresso, fg: colors.cream, border: colors.espresso },
  rose: { bg: colors.rose, fg: colors.espresso, border: colors.rose },
  secondary: { bg: colors.surface, fg: colors.text, border: colors.line },
  ghost: { bg: 'transparent', fg: colors.goldInk, border: 'transparent' },
  danger: { bg: colors.dangerBg, fg: colors.dangerInk, border: colors.dangerBg },
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  size = 'md',
  full,
  style,
}: {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md';
  full?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const p = palette[variant];
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      disabled={off}
      // Küçük buton görselde 36 pt; dokunma alanı dikeyde 44 pt'ye tamamlanır (sarılan satırlardaki 8 pt boşlukla çakışmaz)
      hitSlop={size === 'sm' ? { top: 4, bottom: 4 } : undefined}
      onPress={() => {
        void Haptics.selectionAsync().catch(() => {});
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.base,
        size === 'sm' ? styles.sm : styles.md,
        { backgroundColor: p.bg, borderColor: p.border },
        full && { alignSelf: 'stretch' },
        off && { opacity: 0.5 },
        pressed && { opacity: 0.8 },
        style,
      ]}
    >
      <View style={styles.inner}>
        {loading ? <ActivityIndicator size="small" color={p.fg} /> : icon ? <Icon name={icon} size={size === 'sm' ? 15 : 17} color={p.fg} /> : null}
        <T style={{ fontFamily: fonts.semibold, fontSize: size === 'sm' ? 13 : 15, color: p.fg }}>{title}</T>
      </View>
    </Pressable>
  );
}

/** Yalnızca ikonlu yuvarlak buton (başlık çubuğu vb.) */
export function IconButton({ name, onPress, label, color = colors.text, badge }: { name: IconName; onPress: () => void; label: string; color?: string; badge?: number }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}>
      <Icon name={name} size={21} color={color} />
      {badge ? (
        <View style={styles.badge}>
          <T style={{ color: colors.ivory, fontSize: 10, fontFamily: fonts.bold }}>{badge > 99 ? '99+' : badge}</T>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  md: { minHeight: 48, paddingHorizontal: space.xl },
  sm: { minHeight: 36, paddingHorizontal: space.lg },
  inner: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  // 44 pt kutu: alt alta/yan yana duran ikon butonlarının dokunma alanları üst üste binmez
  iconBtn: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 5, right: 3, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: colors.roseInk, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
});
