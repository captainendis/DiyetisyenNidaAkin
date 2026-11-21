// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Randevu formunun küçük parçaları: seçim kartı, onay kutusu, alan başlığı */
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Icon, T, type IconName } from '@/components/ui';
import { colors, fonts, radius, space } from '@/theme';

/** Tekli seçim kartı (hizmet, ders türü, görüşme tercihi, saat dilimi) */
export function OptionCard({
  title,
  description,
  icon,
  selected,
  onPress,
  role = 'radio',
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  selected: boolean;
  onPress: () => void;
  role?: 'radio' | 'checkbox';
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={role}
      accessibilityState={{ checked: selected }}
      style={({ pressed }) => [styles.option, selected && styles.optionSel, pressed && !selected && { backgroundColor: '#F8F4EE' }]}
    >
      {icon}
      <View style={{ flex: 1, gap: 2 }}>
        <T style={{ fontFamily: fonts.semibold, fontSize: 15, color: selected ? colors.ivory : colors.text }}>{title}</T>
        {description ? <T variant="caption" color={selected ? colors.mist : colors.muted}>{description}</T> : null}
      </View>
      {selected ? <Icon name="check" size={18} color={colors.cream} /> : null}
    </Pressable>
  );
}

/** Onay kutusu — metin içinde bağlantı (iç içe T onPress) olabilir */
export function CheckRow({ checked, onChange, children, error, label }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode; error?: string; label: string }) {
  return (
    <View style={{ gap: 4 }}>
      <Pressable
        onPress={() => onChange(!checked)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={label}
        style={styles.check}
      >
        <View style={[styles.box, checked && styles.boxOn, !!error && !checked && { borderColor: colors.dangerInk }]}>
          {checked ? <Icon name="check" size={14} color={colors.cream} /> : null}
        </View>
        <View style={{ flex: 1 }}>{children}</View>
      </Pressable>
      {error ? <T variant="caption" color={colors.dangerInk} style={{ paddingLeft: 34 }}>{error}</T> : null}
    </View>
  );
}

export function FieldTitle({ children }: { children: string }) {
  return <T variant="label" color={colors.muted} style={{ marginBottom: space.sm }}>{children}</T>;
}

export function Lead({ children, icon }: { children: ReactNode; icon?: IconName }) {
  return (
    <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start' }}>
      {icon ? <Icon name={icon} size={22} color={colors.goldInk} /> : null}
      <View style={{ flex: 1, gap: space.xs }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 56,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  optionSel: { backgroundColor: colors.espresso, borderColor: colors.espresso },
  check: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, minHeight: 44, paddingVertical: 4 },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.mist, alignItems: 'center', justifyContent: 'center', marginTop: 1, backgroundColor: colors.surface },
  boxOn: { backgroundColor: colors.espresso, borderColor: colors.espresso },
});
