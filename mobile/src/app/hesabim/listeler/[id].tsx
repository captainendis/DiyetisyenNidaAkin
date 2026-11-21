// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Liste ayrıntısı (web: PortalPlanPage) — listenin ekran hâli + PDF olarak paylaş */
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import type { PortalPlan } from '@shared/portal';
import { Button, Card, Empty, ErrorView, ListItem, Loading, Screen, Section, T } from '@/components/ui';
import { PlanTimeline } from '@/features/portal/PlanTimeline';
import { usePlanPdf } from '@/features/portal/usePlanPdf';
import { PK } from '@/features/portal/util';
import { ApiError, portalApi } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { useApiQuery } from '@/lib/query';
import { colors, fonts, radius, space } from '@/theme';

export default function PlanDetail() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const q = useApiQuery(PK.plan(id), () => portalApi.get<{ plan: PortalPlan }>(`/plans/${id}`), { enabled: !!id });
  const pdf = usePlanPdf();
  const plan = q.data?.plan;

  if (q.isPending) return <><Stack.Screen options={{ title: 'Liste' }} /><Loading /></>;
  if (q.error instanceof ApiError && q.error.status === 404) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Liste bulunamadı' }} />
        <Empty icon="file-minus" title="Bu liste artık yok." text="Silinmiş ya da bağlantı hatalı olabilir." action={<Button title="Listelerim" variant="secondary" onPress={() => router.replace('/hesabim/listeler')} />} />
      </Screen>
    );
  }
  if (q.error || !plan) return <><Stack.Screen options={{ title: 'Liste' }} /><ErrorView error={q.error} onRetry={() => void q.refetch()} /></>;

  const d = plan.data;
  const water = d.water.show && (d.water.liters || d.water.glasses > 0) ? [d.water.liters && `${d.water.liters} litre`, d.water.glasses > 0 && `${d.water.glasses} bardak`].filter(Boolean).join(' · ') : null;
  const activity = d.activity.show && d.activity.label ? d.activity.label : null;

  return (
    <Screen
      refreshing={q.refreshing}
      onRefresh={q.refresh}
      footer={<Button title="PDF olarak paylaş" icon="share" full loading={pdf.busyId === plan.id} onPress={() => void pdf.share(plan.id, plan.name)} />}
    >
      <Stack.Screen options={{ title: plan.name }} />
      <View style={{ gap: 4, marginBottom: space.xl }}>
        <T variant="display">{plan.name}</T>
        {d.subtitle ? <T color={colors.cocoa}>{d.subtitle}</T> : null}
        <T variant="caption">{formatDate(plan.createdAt)} tarihinde verildi</T>
      </View>

      {water || activity ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.xl }}>
          {water ? <Fact label="Su" value={water} /> : null}
          {activity ? <Fact label="Hareket" value={activity} /> : null}
        </View>
      ) : null}

      <View style={{ marginBottom: space.xl }}>
        <PlanTimeline data={d} />
      </View>

      {d.habits.items.length > 0 ? (
        <View style={styles.habits}>
          {d.habits.title ? <T variant="title" color={colors.ivory} style={{ marginBottom: space.md }}>{d.habits.title}</T> : null}
          <View style={{ gap: space.md }}>
            {d.habits.items.map((h, i) => (
              <T key={i} color={colors.cream}>
                <T style={{ fontFamily: fonts.semibold, color: colors.rose }}>{h.title}</T> {h.text}
              </T>
            ))}
          </View>
        </View>
      ) : null}

      {d.portions.items.length > 0 ? (
        <Section title={d.portions.title || 'Porsiyonlar'}>
          <Card>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {d.portions.items.map((p, i) => (
                <View key={i} style={styles.portion}>
                  <T variant="subheading">{p.name}</T>
                  <T variant="caption">{p.amount}</T>
                </View>
              ))}
            </View>
          </Card>
        </Section>
      ) : null}

      {plan.recipes.length > 0 ? (
        <Section title="Bu listedeki tarifler">
          <Card padded={false}>
            {plan.recipes.map((r, i) => (
              <ListItem key={r.id} icon="book" title={r.title} meta={r.label || undefined} last={i === plan.recipes.length - 1} onPress={() => router.push(`/hesabim/tarifler/${r.id}`)} />
            ))}
          </Card>
        </Section>
      ) : null}

      {d.footerNote || d.signature ? (
        <View style={styles.footer}>
          {d.footerNote ? <T variant="caption">{d.footerNote}</T> : null}
          {d.signature ? <T variant="caption">{d.signature}</T> : null}
        </View>
      ) : null}
    </Screen>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <T variant="label" color={colors.muted}>{label}</T>
      <T variant="subheading">{value}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  fact: { backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: space.lg, paddingVertical: space.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  habits: { backgroundColor: colors.espresso, borderRadius: radius.lg, padding: space.xl, marginBottom: space.xl },
  portion: { backgroundColor: 'rgba(244,235,221,0.6)', borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm, flexGrow: 1, flexBasis: '45%' },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, paddingTop: space.lg, gap: 4 },
});
