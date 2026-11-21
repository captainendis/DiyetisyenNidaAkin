// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Ölçümler (web: PortalProgressPage) — vücut kompozisyonu, kilo grafiği, mezura ölçüleri ve ölçüm geçmişi.
 * Kilo günden güne dalgalanır; tek tek sayılara değil, gidişata bakılır.
 */
import { Stack } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { CIRCUMFERENCES } from '@shared/measurements';
import type { CompositionProfile } from '@shared/body-composition';
import type { PortalMeasurement } from '@shared/portal';
import { Card, Empty, QueryView, Screen, Section, T } from '@/components/ui';
import { BodyComposition } from '@/features/portal/BodyComposition';
import { WeightChart } from '@/features/portal/WeightChart';
import { PK, num } from '@/features/portal/util';
import { portalApi } from '@/lib/api';
import { formatDayStr } from '@/lib/format';
import { useApiQuery } from '@/lib/query';
import { colors, fonts, space } from '@/theme';

const DATE_W = 104;
const COL_W = 78;

function Cell({ children, w, head, bold, left }: { children: string; w: number; head?: boolean; bold?: boolean; left?: boolean }) {
  return (
    <View style={{ width: w, paddingHorizontal: 8, paddingVertical: 10, alignItems: left ? 'flex-start' : 'flex-end' }}>
      <T
        variant={head ? 'label' : 'body'}
        color={head ? colors.muted : colors.text}
        style={[{ fontSize: 14, fontVariant: ['tabular-nums'] }, bold && { fontFamily: fonts.semibold }]}
        numberOfLines={1}
      >
        {children}
      </T>
    </View>
  );
}

export default function MeasurementsScreen() {
  const q = useApiQuery(PK.measurements, () => portalApi.get<{ items: PortalMeasurement[]; profile: CompositionProfile }>('/measurements'));
  return (
    <Screen refreshing={q.refreshing} onRefresh={q.refresh}>
      <Stack.Screen options={{ title: 'Ölçümler' }} />
      <T muted style={{ marginBottom: space.lg }}>Görüşmelerde alınan ölçümlerin. Kilo günden güne dalgalanır; tek tek sayılara değil, birkaç ölçümün gidişatına bak.</T>
      <QueryView query={q}>
        {(data) => {
          const items = data.items;
          if (!items.length) return <Empty icon="trending-down" title="Henüz ölçüm yok." text="Görüşmede alınan ölçümlerin burada görünecek." />;
          const usedCirc = CIRCUMFERENCES.filter(({ key }) => items.some((m) => m[key] != null));
          const circRows = items.filter((m) => usedCirc.some(({ key }) => m[key] != null));
          const weighed = items.filter((m) => m.weightKg != null).length;
          return (
            <>
              {data.profile ? (
                <Section title="Vücut kompozisyonu">
                  <Card>
                    <BodyComposition items={items} profile={data.profile} />
                  </Card>
                </Section>
              ) : null}

              {weighed > 1 ? (
                <Section title="Kilo">
                  <Card>
                    <T variant="label" style={{ marginBottom: space.sm }}>Kilo zaman içinde nasıl değişti?</T>
                    <WeightChart items={items} />
                  </Card>
                </Section>
              ) : null}

              {usedCirc.length > 0 ? (
                <Section title="Mezura ölçüleri (cm)">
                  <Card padded={false}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View>
                        <View style={[styles.row, styles.head]}>
                          <Cell w={DATE_W} head left>Tarih</Cell>
                          {usedCirc.map(({ key, label }) => <Cell key={key} w={COL_W} head>{label}</Cell>)}
                        </View>
                        {circRows.map((m, i) => (
                          <View key={m.id} style={[styles.row, i < circRows.length - 1 && styles.line]}>
                            <Cell w={DATE_W} left>{formatDayStr(m.measuredOn, 'd MMM yyyy')}</Cell>
                            {usedCirc.map(({ key }) => <Cell key={key} w={COL_W}>{m[key] == null ? '—' : num(m[key], '').trim()}</Cell>)}
                          </View>
                        ))}
                      </View>
                    </ScrollView>
                  </Card>
                </Section>
              ) : null}

              <Section title="Ölçüm geçmişi">
                <Card padded={false}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
                    <View style={{ flex: 1 }}>
                      <View style={[styles.row, styles.head]}>
                        <Cell w={DATE_W} head left>Tarih</Cell>
                        <Cell w={COL_W} head>Kilo</Cell>
                        <Cell w={COL_W} head>Boy</Cell>
                        <Cell w={COL_W} head>Hedef</Cell>
                      </View>
                      {items.map((m, i) => (
                        <View key={m.id} style={[styles.row, i < items.length - 1 && styles.line]}>
                          <Cell w={DATE_W} left>{formatDayStr(m.measuredOn, 'd MMM yyyy')}</Cell>
                          <Cell w={COL_W} bold>{num(m.weightKg, 'kg')}</Cell>
                          <Cell w={COL_W}>{num(m.heightCm, 'cm')}</Cell>
                          <Cell w={COL_W}>{num(m.targetWeightKg, 'kg')}</Cell>
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                </Card>
              </Section>
            </>
          );
        }}
      </QueryView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', paddingHorizontal: 8 },
  head: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  line: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
});
