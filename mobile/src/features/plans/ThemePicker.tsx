// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Plan renk teması seçici: her seçenek PDF'in küçük bir taslağını temanın gerçek renkleriyle gösterir
 * (zemin, öğün kartı, saat noktası, alışkanlıklar kutusu) — web: PlanEditorForm ThemePicker.
 */
import { Pressable, StyleSheet, View } from 'react-native';
import { Icon, T } from '@/components/ui';
import { colors, radius, space } from '@/theme';
import { PLAN_THEME_IDS, PLAN_THEMES, type PlanThemeId } from '@shared/plan';

export function ThemePicker({ value, onChange, disabled }: { value: PlanThemeId; onChange: (v: PlanThemeId) => void; disabled?: boolean }) {
  return (
    <View style={{ gap: 6 }} accessibilityRole="radiogroup" accessibilityLabel="Renk teması">
      <T variant="label">Renk teması</T>
      <View style={styles.grid}>
        {PLAN_THEME_IDS.map((id) => {
          const th = PLAN_THEMES[id];
          const c = th.colors;
          const selected = value === id;
          const white = c.bg.toLowerCase() === '#ffffff';
          return (
            <Pressable
              key={id}
              disabled={disabled}
              onPress={() => onChange(id)}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled }}
              accessibilityLabel={`${th.label}, ${th.note}`}
              style={[styles.item, selected && styles.itemSel]}
            >
              <View style={[styles.swatch, { backgroundColor: c.bg }, white && { borderWidth: 1, borderColor: c.line }]}>
                <View style={[styles.card, { backgroundColor: c.card }, c.card.toLowerCase() === c.bg.toLowerCase() && { borderWidth: 1, borderColor: c.line }]}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.accent, borderWidth: 1, borderColor: c.ink, marginTop: 1 }} />
                  <View style={{ flex: 1, gap: 4, paddingTop: 1 }}>
                    <View style={{ height: 3, width: '80%', borderRadius: 2, backgroundColor: c.ink }} />
                    <View style={{ height: 3, width: '60%', borderRadius: 2, backgroundColor: c.muted }} />
                  </View>
                </View>
                <View style={[styles.dark, { backgroundColor: c.dark }]}>
                  <View style={{ height: 3, width: '75%', borderRadius: 2, backgroundColor: c.darkAccent }} />
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 4 }}>
                <View style={{ flex: 1 }}>
                  <T variant="label" numberOfLines={1}>{th.label}</T>
                  <T variant="caption" style={{ fontSize: 12, lineHeight: 15 }} numberOfLines={2}>{th.note}</T>
                </View>
                {selected ? <Icon name="check" size={16} color={colors.cocoa} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  item: { width: '48.5%', gap: space.sm, padding: space.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  itemSel: { borderColor: colors.cocoa, borderWidth: 2, padding: space.sm - 1 },
  swatch: { height: 52, borderRadius: 8, padding: 6, flexDirection: 'row', gap: 4 },
  card: { flex: 1, borderRadius: 4, padding: 5, flexDirection: 'row', gap: 4, alignItems: 'flex-start' },
  dark: { width: '33%', borderRadius: 4, padding: 5, justifyContent: 'flex-end' },
});
