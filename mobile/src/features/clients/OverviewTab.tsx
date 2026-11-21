// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import { Linking, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Card, Grid, KeyValue, Section, StatTile, T } from '@/components/ui';
import { useStaff } from '@/lib/auth';
import { formatDate, formatDayStr, formatPhone, formatTime } from '@/lib/format';
import { APPOINTMENT_STATUS_LABEL, CLIENT_SEX_LABEL, MEETING_TYPE_LABEL } from '@shared/constants';
import { colors, space } from '@/theme';
import { ConsentPanel } from './Consent';
import { PortalAccountCard } from './PortalAccountCard';
import { type Client, type ClientStats } from './types';

function Link({ text, onPress }: { text: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="link" hitSlop={12}>
      <T style={{ textAlign: 'right', textDecorationLine: 'underline' }} color={colors.goldInk}>{text}</T>
    </Pressable>
  );
}

export function OverviewTab({ client, stats, onClientChanged }: { client: Client; stats: ClientStats; onClientChanged: (c: Client) => void }) {
  const { can } = useStaff();
  const next = stats.nextAppointment;
  return (
    <View style={{ gap: space.xl }}>
      <Grid>
        <StatTile label="Toplam görüşme" value={stats.totalVisits} hint="Tamamlanan" />
        <StatTile label="Son görüşme" value={<T variant="heading">{stats.lastVisitAt ? formatDate(stats.lastVisitAt) : 'Henüz yok'}</T>} />
        <StatTile
          label="Gelecek randevu"
          onPress={next ? () => router.push(`/panel/randevular/${next.id}`) : undefined}
          icon={next ? 'chevron-right' : undefined}
          value={<T variant="heading">{next ? `${formatDate(next.startsAt)} · ${formatTime(next.startsAt)}` : 'Planlanmadı'}</T>}
          hint={next ? APPOINTMENT_STATUS_LABEL[next.status] : undefined}
        />
        <StatTile label="İlk kayıt" value={<T variant="heading">{formatDate(client.createdAt)}</T>} />
      </Grid>

      <Section title="Danışan bilgileri" style={{ marginBottom: 0 }}>
        <Card>
          <KeyValue label="Telefon" value={<Link text={formatPhone(client.phone)} onPress={() => void Linking.openURL(`tel:${client.phone}`)} />} />
          <KeyValue label="E-posta" value={client.email ? <Link text={client.email} onPress={() => void Linking.openURL(`mailto:${client.email}`)} /> : '—'} />
          <KeyValue label="Doğum tarihi" value={client.birthDate ? formatDayStr(client.birthDate) : '—'} />
          <KeyValue label="Cinsiyet" value={client.sex ? CLIENT_SEX_LABEL[client.sex] : '—'} />
          <KeyValue
            label="İlk görüşme tarihi"
            value={client.firstVisitDate ? formatDayStr(client.firstVisitDate) : stats.firstAppointmentAt ? formatDate(stats.firstAppointmentAt) : '—'}
          />
          <KeyValue label="Görüşme tercihi" value={client.preferredMeetingType ? MEETING_TYPE_LABEL[client.preferredMeetingType] : '—'} />
          <KeyValue label="Kayıt kaynağı" value={client.source === 'WEBSITE' ? 'Web sitesi randevu talebi' : 'Panelden eklendi'} />
          <KeyValue label="Dahili not" value={client.internalNote || '—'} last />
        </Card>
      </Section>

      <ConsentPanel client={client} onChanged={onClientChanged} />
      {can('portal:manage') ? <PortalAccountCard client={client} /> : null}
    </View>
  );
}
