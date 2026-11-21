// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Genel bakış sayı kartı: değer, karşılaştırma, son 7 gün eğilimi; (i) tanımı gösterir */
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Icon, T } from '@/components/ui';
import { colors, fonts, radius, shadow, space } from '@/theme';
import { Sparkline } from './Sparkline';

export function StatCard({ label, value, definition, comparison, series, seriesLabel }: { label: string; value: number; definition: string; comparison: string; series: number[]; seriesLabel: string }) {
  return (
    <View style={styles.card}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 4 }}>
        <T variant="label" style={{ flex: 1 }} numberOfLines={2}>{label}</T>
        <Pressable onPress={() => Alert.alert(label, definition)} hitSlop={12} accessibilityRole="button" accessibilityLabel={`${label}: tanım`}>
          <Icon name="info" size={15} color={colors.muted} />
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: space.sm }}>
        <T style={styles.value}>{value.toLocaleString('tr-TR')}</T>
        <Sparkline values={series} label={seriesLabel} width={64} />
      </View>
      <T variant="caption" style={{ fontSize: 12, lineHeight: 16 }}>{comparison}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md, gap: space.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, ...shadow.card },
  value: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 32, color: colors.text, fontVariant: ['tabular-nums'] },
});
