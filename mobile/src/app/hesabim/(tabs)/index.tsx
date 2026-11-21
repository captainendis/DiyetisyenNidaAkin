// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Özet (web: PortalHomePage) — güncel liste (öğün saatleriyle), sıradaki görüşme, son mesaj, kilo durumu.
 * Pilates danışanında sıradaki ders; yalnızca pilatese gelen danışanda beslenme kartları yerine pilates özeti.
 */
import { router } from 'expo-router';
import { View } from 'react-native';
import { MEETING_TYPE_LABEL } from '@shared/constants';
import type { PortalOverview, PortalPlan } from '@shared/portal';
import { Button, Card, KeyValue, Loading, QueryView, Screen, Section, T } from '@/components/ui';
import { PlanTimeline } from '@/features/portal/PlanTimeline';
import { usePlanPdf } from '@/features/portal/usePlanPdf';
import { PK, kg, openBooking } from '@/features/portal/util';
import { portalApi } from '@/lib/api';
import { useClient } from '@/lib/auth';
import { formatDate, formatDateLong, formatDayStr, formatTime } from '@/lib/format';
import { useApiQuery } from '@/lib/query';
import { colors, fonts, space } from '@/theme';

const big = { fontFamily: fonts.display, fontSize: 30, lineHeight: 34, color: colors.text };

function Link({ title, onPress }: { title: string; onPress: () => void }) {
  return <Button title={title} variant="ghost" size="sm" onPress={onPress} />;
}

function NextClass({ data, large }: { data: PortalOverview; large: boolean }) {
  const c = data.nextClass;
  return (
    <Section title="Sıradaki pilates dersin" action={<Link title={large ? 'Tüm dersler' : 'Pilates'} onPress={() => router.push('/hesabim/pilates')} />}>
      <Card>
        {c ? (
          <View style={{ gap: 4 }}>
            <T style={[big, large && { fontSize: 34, lineHeight: 38 }]}>{formatDate(c.startsAt)}</T>
            <T variant="subheading">{formatTime(c.startsAt)}–{formatTime(c.endsAt)}</T>
            <T variant="caption">{c.title}</T>
          </View>
        ) : (
          <View style={{ gap: space.md }}>
            <T color={colors.cocoa}>Planlanmış dersin yok.</T>
            <Button title="Ders talep et" variant="secondary" size="sm" onPress={() => router.push('/hesabim/pilates')} style={{ alignSelf: 'flex-start' }} />
          </View>
        )}
      </Card>
    </Section>
  );
}

export default function ClientHome() {
  const me = useClient();
  const q = useApiQuery(PK.overview, () => portalApi.get<PortalOverview>('/overview'));
  const planId = q.data?.latestPlan?.id;
  const plan = useApiQuery(PK.plan(planId ?? ''), () => portalApi.get<{ plan: PortalPlan }>(`/plans/${planId}`), { enabled: !!planId && me.programs.nutrition });
  const pdf = usePlanPdf();
  const nutrition = me.programs.nutrition;
  const pilates = me.programs.pilates;

  return (
    <Screen
      refreshing={q.refreshing}
      onRefresh={() => {
        void q.refresh();
        if (planId) void plan.refetch();
      }}
    >
      <View style={{ marginBottom: space.xl, gap: 2 }}>
        <T variant="caption">{formatDateLong(new Date())}</T>
        <T variant="display">Merhaba {me.firstName}.</T>
      </View>
      <QueryView query={q}>
        {(data) => {
          const w = data.weight;
          const change = w.current != null && w.first != null ? Math.round((w.current - w.first) * 10) / 10 : null;
          return (
            <>
              {!nutrition ? (
                <NextClass data={data} large />
              ) : (
                <Section title="Güncel listen" action={data.latestPlan ? <Link title="Tüm listeler" onPress={() => router.push('/hesabim/listeler')} /> : undefined}>
                  <Card>
                    {data.latestPlan ? (
                      <View style={{ gap: space.lg }}>
                        <View style={{ gap: 2 }}>
                          <T variant="title">{data.latestPlan.name}</T>
                          <T variant="caption">{formatDate(data.latestPlan.createdAt)} tarihinde verildi</T>
                        </View>
                        {plan.data?.plan ? <PlanTimeline data={plan.data.plan.data} compact /> : <Loading />}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                          <Button title="Listeyi aç" icon="book-open" size="sm" onPress={() => router.push(`/hesabim/listeler/${data.latestPlan!.id}`)} />
                          <Button
                            title="PDF olarak paylaş"
                            icon="share"
                            variant="secondary"
                            size="sm"
                            loading={pdf.busyId === data.latestPlan.id}
                            onPress={() => void pdf.share(data.latestPlan!.id, data.latestPlan!.name)}
                          />
                        </View>
                      </View>
                    ) : (
                      <T color={colors.cocoa}>Henüz sana verilmiş bir beslenme listesi yok. Görüşmeden sonra listen burada görünecek.</T>
                    )}
                  </Card>
                </Section>
              )}

              {nutrition && pilates ? <NextClass data={data} large={false} /> : null}

              {nutrition ? (
                <Section title="Sıradaki görüşme">
                  <Card onPress={data.nextAppointment?.startsAt ? () => router.push('/hesabim/randevular') : undefined}>
                    {data.nextAppointment?.startsAt ? (
                      <View style={{ gap: 4 }}>
                        <T style={big}>{formatDate(data.nextAppointment.startsAt)}</T>
                        <T variant="subheading">{formatTime(data.nextAppointment.startsAt)}</T>
                        <T variant="caption">
                          {MEETING_TYPE_LABEL[data.nextAppointment.meetingType]}
                          {data.nextAppointment.status === 'PENDING' ? ' · onay bekliyor' : ''}
                        </T>
                      </View>
                    ) : (
                      <View style={{ gap: space.md }}>
                        <T color={colors.cocoa}>Planlanmış bir görüşmen yok.</T>
                        <Button title="Randevu talep et" variant="secondary" size="sm" icon="calendar" onPress={() => openBooking()} style={{ alignSelf: 'flex-start' }} />
                      </View>
                    )}
                  </Card>
                </Section>
              ) : null}

              {nutrition && (w.current != null || w.target != null) ? (
                <Section title="Kilo" action={<Link title="Ayrıntı" onPress={() => router.push('/hesabim/olcumler')} />}>
                  <Card>
                    {w.current != null ? <T style={[big, { fontSize: 34, lineHeight: 38, marginBottom: space.sm }]}>{kg(w.current)}</T> : null}
                    {change != null && change !== 0 ? <KeyValue label="Başlangıçtan beri" value={`${change > 0 ? '+' : '−'}${kg(Math.abs(change))}`} /> : null}
                    {w.target != null ? <KeyValue label="Hedef" value={kg(w.target)} /> : null}
                    {w.measuredOn ? <KeyValue label="Son ölçüm" value={formatDayStr(w.measuredOn, 'd MMM yyyy')} last /> : null}
                  </Card>
                </Section>
              ) : null}

              {data.latestMessage ? (
                <Section title="Diyetisyeninden" action={<Link title="Tümü" onPress={() => router.push('/hesabim/mesajlar')} />}>
                  <Card onPress={() => router.push('/hesabim/mesajlar')}>
                    <T numberOfLines={6}>{data.latestMessage.content}</T>
                    <T variant="caption" style={{ marginTop: space.sm }}>{formatDate(data.latestMessage.createdAt)}</T>
                  </Card>
                </Section>
              ) : null}
            </>
          );
        }}
      </QueryView>
    </Screen>
  );
}
