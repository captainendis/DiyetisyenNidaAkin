// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import { View } from 'react-native';
import { router } from 'expo-router';
import { Badge, Button, Card, Empty, ListItem, QueryView, Section, T } from '@/components/ui';
import { api } from '@/lib/api';
import { useStaff } from '@/lib/auth';
import { formatDateLong, formatTime } from '@/lib/format';
import { useApiQuery } from '@/lib/query';
import { APPOINTMENT_STATUS_LABEL, MEETING_TYPE_LABEL } from '@shared/constants';
import { space } from '@/theme';
import { APPOINTMENT_STATUS_TONE, clientKeys, type ClientAppointment } from './types';

/** Danışanın randevuları (ayrıca Mesajlar sekmesinde görüşme seçimi için kullanılır) */
export function useClientAppointments(clientId: string) {
  return useApiQuery(clientKeys.sub(clientId, 'appointments'), () => api.get<{ items: ClientAppointment[] }>(`/clients/${clientId}/appointments`));
}

function Rows({ rows }: { rows: ClientAppointment[] }) {
  return (
    <Card padded={false}>
      {rows.map((a, i) => (
        <ListItem
          key={a.id}
          last={i === rows.length - 1}
          onPress={() => router.push(`/panel/randevular/${a.id}`)}
          title={a.startsAt ? formatDateLong(a.startsAt) : 'Saat belirlenmedi'}
          subtitle={[a.startsAt ? `${formatTime(a.startsAt)}${a.endsAt ? `–${formatTime(a.endsAt)}` : ''}` : null, MEETING_TYPE_LABEL[a.meetingType], a.service?.title].filter(Boolean).join(' · ')}
          right={<Badge label={APPOINTMENT_STATUS_LABEL[a.status]} tone={APPOINTMENT_STATUS_TONE[a.status]} />}
        />
      ))}
    </Card>
  );
}

export function AppointmentsTab({ clientId }: { clientId: string }) {
  const { can } = useStaff();
  const q = useClientAppointments(clientId);
  const newAppt = () => router.push(`/panel/randevular/yeni?clientId=${clientId}`);
  const canCreate = can('appointments:write');
  return (
    <QueryView query={q}>
      {(data) => {
        if (!data.items.length) {
          return (
            <Card>
              <Empty
                icon="calendar"
                title="Henüz randevu bulunmuyor."
                text="Bu danışan için oluşturulan randevular burada görünür."
                action={canCreate ? <Button title="Randevu oluştur" icon="calendar" onPress={newAppt} /> : undefined}
              />
            </Card>
          );
        }
        const now = Date.now();
        const upcoming = data.items.filter((a) => a.startsAt && new Date(a.startsAt).getTime() >= now).reverse();
        const past = data.items.filter((a) => !a.startsAt || new Date(a.startsAt).getTime() < now);
        return (
          <View>
            <Section title="Gelecek randevular" action={canCreate ? <Button title="Yeni randevu" icon="plus" size="sm" variant="secondary" onPress={newAppt} /> : undefined}>
              {upcoming.length ? <Rows rows={upcoming} /> : <T variant="caption" style={{ paddingHorizontal: 2 }}>Planlanmış bir randevu yok.</T>}
            </Section>
            <Section title={`Geçmiş randevular (${past.length})`} style={{ marginBottom: space.sm }}>
              {past.length ? <Rows rows={past} /> : <T variant="caption" style={{ paddingHorizontal: 2 }}>Geçmiş randevu yok.</T>}
            </Section>
          </View>
        );
      }}
    </QueryView>
  );
}
