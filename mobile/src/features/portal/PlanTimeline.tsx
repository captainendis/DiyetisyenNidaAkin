// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Beslenme listesinin ekran hâli — basılı plandaki zaman çizelgesi (saat noktası + öğün + seçenekler).
 * Nokta rengi planın seçili temasından gelir. `compact`: yalnızca saat + öğün adı (Özet ekranı).
 */
import { StyleSheet, View } from 'react-native';
import { PLAN_THEMES, type NutritionPlanData } from '@shared/plan';
import { T } from '@/components/ui';
import { colors, fonts, radius, space } from '@/theme';

export function PlanTimeline({ data, compact = false }: { data: Pick<NutritionPlanData, 'meals' | 'theme'>; compact?: boolean }) {
  const accent = (PLAN_THEMES[data.theme] ?? PLAN_THEMES.green).colors.accent;
  return (
    <View style={styles.wrap}>
      <View style={styles.rail} />
      {data.meals.map((m, mi) => {
        const options = m.options.map((o) => o.filter(Boolean)).filter((o) => o.length);
        return (
          <View key={mi} style={styles.item}>
            <View style={[styles.dot, { backgroundColor: accent }]} />
            <View style={styles.head}>
              {m.time ? <T style={styles.time}>{m.time}</T> : null}
              <T variant="subheading" color={colors.cocoa}>{m.name}</T>
              {compact && options.length > 1 ? <T variant="caption">{options.length} seçenek</T> : null}
            </View>
            {!compact ? (
              <View style={{ gap: space.sm, marginTop: space.sm }}>
                {options.map((o, oi) => (
                  <View key={oi} style={styles.option}>
                    {options.length > 1 ? <T variant="label" color={colors.muted} style={{ marginBottom: 4 }}>{oi + 1}. seçenek</T> : null}
                    {o.map((line, li) => (
                      <T key={li} style={{ lineHeight: 21 }}>{line}</T>
                    ))}
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.lg, position: 'relative' },
  rail: { position: 'absolute', top: 12, bottom: 12, left: 7, width: StyleSheet.hairlineWidth * 2, backgroundColor: 'rgba(33,23,16,0.15)' },
  item: { paddingLeft: 30 },
  dot: { position: 'absolute', left: 0, top: 6, width: 15, height: 15, borderRadius: 8, borderWidth: 1.5, borderColor: colors.espresso },
  head: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: space.md },
  time: { fontFamily: fonts.displayBold, fontSize: 26, lineHeight: 28, color: colors.text },
  option: { backgroundColor: colors.surface, borderRadius: radius.md, padding: space.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
});
