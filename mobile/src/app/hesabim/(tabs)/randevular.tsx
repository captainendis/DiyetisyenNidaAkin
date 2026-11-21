// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Randevular (web: PortalAppointmentsPage) — diyet ve pilates için ortak: yanıt bekleyen taleplerim, randevularım,
 * önümüzdeki iki haftanın boş zamanları. Randevu değişikliği / iptali diyetisyenle iletişimle yapılır.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { APPOINTMENT_STATUS_LABEL, MEETING_TYPE_LABEL, PILATES_FORMAT_LABEL, pilatesPreferenceText } from '@shared/constants';
import type { PortalAppointment, PortalRequest } from '@shared/portal';
import { Badge, Button, Card, Empty, ErrorView, ListItem, Loading, Screen, Section, T } from '@/components/ui';
import { Availability, useAvailability } from '@/features/portal/Availability';
import { PilatesRequestSheet } from '@/features/portal/PilatesRequestSheet';
import { APPOINTMENT_TONE, PK, openBooking } from '@/features/portal/util';
import { portalApi } from '@/lib/api';
import { useClient } from '@/lib/auth';
import { formatDate, formatTime } from '@/lib/format';
import { useApiQuery } from '@/lib/query';
import { colors, space } from '@/theme';

function AppointmentRow({ a, last }: { a: PortalAppointment; last: boolean }) {
  return (
    <ListItem
      last={last}
      title={a.startsAt ? formatDate(a.startsAt) : 'Tarih belirlenecek'}
      subtitle={[a.startsAt && formatTime(a.startsAt), MEETING_TYPE_LABEL[a.meetingType], a.service].filter(Boolean).join(' · ')}
      right={<Badge label={APPOINTMENT_STATUS_LABEL[a.status]} tone={APPOINTMENT_TONE[a.status] ?? 'neutral'} />}
    />
  );
}

function RequestRow({ r, last }: { r: PortalRequest; last: boolean }) {
  const pilates = r.kind === 'PILATES';
  const when = r.startsAt
    ? `İstediğin zaman: ${formatDate(r.startsAt)} ${formatTime(r.startsAt)}`
    : pilates
      ? pilatesPreferenceText(r.preferredDays, r.preferredDayparts)
      : 'Zaman birlikte planlanacak';
  return (
    <ListItem
      last={last}
      icon={pilates ? 'activity' : 'clipboard'}
      title={pilates ? `Pilates · ${r.pilatesFormat ? PILATES_FORMAT_LABEL[r.pilatesFormat] : 'ders'}` : `Diyet görüşmesi${r.service ? ` · ${r.service}` : ''}`}
      subtitle={`${when} · ${formatDate(r.createdAt)} tarihinde gönderildi`}
      right={<Badge label="Yanıt bekliyor" tone="warning" />}
    />
  );
}

export default function AppointmentsTab() {
  const me = useClient();
  const q = useApiQuery(PK.appointments, () => portalApi.get<{ items: PortalAppointment[] }>('/appointments'));
  const requests = useApiQuery(PK.requests, () => portalApi.get<{ items: PortalRequest[] }>('/requests'));
  const availability = useAvailability();
  const [pilatesOpen, setPilatesOpen] = useState(false);

  // Pilates danışanı hesabındaki ders talebi formundan, diğerleri randevu talebi ekranından (pilates türüyle) talep eder
  const requestPilates = () => (me.programs.pilates ? setPilatesOpen(true) : openBooking('pilates'));

  const now = Date.now();
  const scheduled = (q.data?.items ?? []).filter((a) => a.status !== 'PENDING');
  const upcoming = scheduled.filter((a) => a.startsAt && new Date(a.startsAt).getTime() > now && a.status !== 'CANCELLED').reverse();
  const past = scheduled.filter((a) => !upcoming.includes(a));
  const open = requests.data?.items ?? [];
  const refreshing = q.refreshing || requests.refreshing || availability.consult.refreshing;

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={() => {
        void q.refresh();
        void requests.refresh();
        void availability.consult.refetch();
        void availability.pilates.refetch();
      }}
    >
      <T muted style={{ marginBottom: space.lg }}>
        Taleplerin, randevuların ve önümüzdeki iki haftanın boş zamanları. Randevunu değiştirmek ya da iptal etmek için diyetisyeninle iletişime geç.
      </T>
      <View style={{ gap: space.sm, marginBottom: space.xl }}>
        <Button title="Diyet randevusu talep et" icon="calendar" full onPress={() => openBooking()} />
        <Button title="Pilates dersi talep et" variant="secondary" icon="send" full onPress={requestPilates} />
      </View>

      {open.length > 0 ? (
        <Section title="Yanıt bekleyen taleplerin">
          <Card padded={false}>
            {open.map((r, i) => <RequestRow key={r.id} r={r} last={i === open.length - 1} />)}
          </Card>
        </Section>
      ) : null}

      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <ErrorView error={q.error} onRetry={() => void q.refetch()} />
      ) : !upcoming.length && !past.length ? (
        !open.length ? (
          <Empty icon="calendar" title="Henüz randevun yok." text="Diyet görüşmesi ya da pilates dersi için yukarıdan talep oluşturabilirsin; onaylanınca burada görünür." />
        ) : null
      ) : (
        <>
          {upcoming.length > 0 ? (
            <Section title="Yaklaşan">
              <Card padded={false}>
                {upcoming.map((a, i) => <AppointmentRow key={a.id} a={a} last={i === upcoming.length - 1} />)}
              </Card>
            </Section>
          ) : null}
          {past.length > 0 ? (
            <Section title="Geçmiş görüşmeler">
              <Card padded={false}>
                {past.map((a, i) => <AppointmentRow key={a.id} a={a} last={i === past.length - 1} />)}
              </Card>
            </Section>
          ) : null}
        </>
      )}

      {me.programs.pilates ? (
        <Card onPress={() => router.push('/hesabim/pilates')} style={{ marginBottom: space.xl }}>
          <T color={colors.cocoa}>Pilates derslerin <T style={{ color: colors.text, textDecorationLine: 'underline' }}>Pilates</T> sekmesinde.</T>
        </Card>
      ) : null}

      <Availability data={availability} onConsult={() => openBooking()} onPilates={requestPilates} />

      {me.programs.pilates ? <PilatesRequestSheet visible={pilatesOpen} onClose={() => setPilatesOpen(false)} /> : null}
    </Screen>
  );
}
