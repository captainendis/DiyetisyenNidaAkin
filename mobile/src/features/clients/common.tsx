// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import { useCallback, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Card, Empty, Icon, T } from '@/components/ui';
import { queryClient } from '@/lib/query';
import { colors, fonts, radius, space } from '@/theme';
import { clientKeys, type Client, type ClientDetail } from './types';

/** Sunucunun döndürdüğü güncel danışanı önbelleğe yazar ve listeyi tazeler */
export function useClientChanged(id: string) {
  return useCallback(
    (c: Client) => {
      queryClient.setQueryData<ClientDetail>(clientKeys.detail(id), (d) => (d ? { ...d, client: c } : d));
      void queryClient.invalidateQueries({ queryKey: ['clients', 'list'] });
    },
    [id],
  );
}

export function ClinicalLocked() {
  return (
    <Card>
      <Empty
        icon="lock"
        title="Bu bölüm klinik yetki gerektirir"
        text="Görüşme notları, ölçümler ve sağlık belgeleri özel nitelikli kişisel veri olabileceğinden yalnızca diyetisyen ve yönetici rollerine açıktır."
      />
    </Card>
  );
}

/** Kart içinde küçük başlık + açıklama */
export function CardTitle({ title, text, right }: { title: string; text?: string; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.md, marginBottom: space.md }}>
      <View style={{ flex: 1, gap: 2 }}>
        <T variant="heading">{title}</T>
        {text ? <T variant="caption">{text}</T> : null}
      </View>
      {right}
    </View>
  );
}

/** Yatay kayan sekme çubuğu */
export function TabBar<V extends string>({ value, tabs, onChange }: { value: V; tabs: { value: V; label: string; locked?: boolean }[]; onChange: (v: V) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs} style={{ marginHorizontal: -space.lg, marginBottom: space.lg }}>
      {tabs.map((t) => {
        const sel = t.value === value;
        return (
          <Pressable
            key={t.value}
            onPress={() => onChange(t.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: sel }}
            accessibilityLabel={t.locked ? `${t.label} (klinik yetki gerekir)` : t.label}
            style={[styles.tab, sel && styles.tabSel]}
          >
            <T style={{ fontFamily: fonts.semibold, fontSize: 13, color: sel ? colors.cream : colors.text }}>{t.label}</T>
            {t.locked ? <Icon name="lock" size={12} color={sel ? colors.cream : colors.muted} /> : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Sayı biçimleri (tr) */
export const n1 = (v: number) => v.toLocaleString('tr-TR', { maximumFractionDigits: 1 });
export const n2 = (v: number) => v.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const withUnit = (v: number | null | undefined, unit: string) => (v == null ? '—' : `${v.toLocaleString('tr-TR')} ${unit}`);

const styles = StyleSheet.create({
  tabs: { paddingHorizontal: space.lg, gap: space.sm },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  tabSel: { backgroundColor: colors.espresso, borderColor: colors.espresso },
});
