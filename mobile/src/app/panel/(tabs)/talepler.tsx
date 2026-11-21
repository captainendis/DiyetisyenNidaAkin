// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Talepler ve müsaitlik — yanıt bekleyen diyet ve pilates talepleri (yeni talep + onay bekleyen), türe göre süzülür;
 * altında önümüzdeki 14 günün boş saatleri ve pilates kontenjanı. Web: /panel/talepler (RequestsPage).
 * Talebe dokununca randevu detayı açılır (saat atama, onay, iptal orada); listede hızlı onay/ret de vardır.
 */
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { PILATES_FORMAT_LABEL, pilatesPreferenceText, type AppointmentKind } from '@shared/constants';
import { Button, Card, confirm, Empty, ErrorView, Loading, Screen, Section, Segmented, T, useToast } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useStaff } from '@/lib/auth';
import { formatDayStr, formatPhone, relativeTime } from '@/lib/format';
import { useApiMutation, useApiQuery } from '@/lib/query';
import { colors, space } from '@/theme';
import { StatusBadge } from '@/features/appointments/AppointmentRow';
import { APPOINTMENT_INVALIDATE, displayName, type AppointmentDTO } from '@/features/appointments/types';
import { ConsultationAvailability, PilatesAvailability } from '@/features/appointments/Availability';

type Tab = 'tumu' | 'diyet' | 'pilates';
const TAB_KIND: Record<Tab, AppointmentKind | undefined> = { tumu: undefined, diyet: 'CONSULTATION', pilates: 'PILATES' };

export default function RequestsScreen() {
  const { can } = useStaff();
  const canWrite = can('appointments:write');
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('tumu');
  const list = useApiQuery(['appointments', 'requests'], () =>
    api.get<{ items: AppointmentDTO[]; total: number }>('/appointments', { status: ['NEW_REQUEST', 'PENDING'], pageSize: 200, sort: '-createdAt' }),
  );
  const counts = useMemo(() => {
    const items = list.data?.items ?? [];
    return { tumu: items.length, diyet: items.filter((a) => a.kind === 'CONSULTATION').length, pilates: items.filter((a) => a.kind === 'PILATES').length };
  }, [list.data]);
  const kind = TAB_KIND[tab];
  const items = (list.data?.items ?? []).filter((a) => !kind || a.kind === kind);

  const [refreshKey, setRefreshKey] = useState(0);
  const quick = useApiMutation(
    ({ a, status }: { a: AppointmentDTO; status: 'CONFIRMED' | 'CANCELLED' }) =>
      api.post(`/appointments/${a.id}/status`, { status, note: status === 'CANCELLED' ? 'Talepler ekranından reddedildi' : null }),
    { invalidate: APPOINTMENT_INVALIDATE, onSuccess: (_, v) => toast(`${v.status === 'CONFIRMED' ? 'Randevu onaylandı' : 'Talep reddedildi'} · ${displayName(v.a)}`) },
  );
  const act = async (a: AppointmentDTO, status: 'CONFIRMED' | 'CANCELLED') => {
    if (status === 'CANCELLED') {
      const ok = await confirm({
        title: 'Talep reddedilsin mi?',
        message: `${displayName(a)} adlı kişinin talebi “İptal Edildi” olarak işaretlenecek. Kişiye otomatik bildirim gönderilmez; gerekirse telefonla bilgilendirin.`,
        confirmText: 'Reddet',
        destructive: true,
      });
      if (!ok) return;
    }
    quick.mutate({ a, status }, { onError: (e) => toast(errorMessage(e), 'error') });
  };
  const busy = (a: AppointmentDTO, s: string) => quick.isPending && quick.variables?.a.id === a.id && quick.variables.status === s;

  return (
    <Screen
      refreshing={list.refreshing}
      onRefresh={() => {
        void list.refresh();
        setRefreshKey((k) => k + 1);
      }}
    >
      <Section>
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'tumu', label: `Tümü (${counts.tumu})` },
            { value: 'diyet', label: `Diyet (${counts.diyet})` },
            { value: 'pilates', label: `Pilates (${counts.pilates})` },
          ]}
        />
      </Section>

      <Section title="Yanıt bekleyen talepler">
        {list.error ? (
          <ErrorView error={list.error} onRetry={() => void list.refetch()} />
        ) : !list.data ? (
          <Loading />
        ) : !items.length ? (
          <Card>
            <Empty icon="inbox" title="Yanıt bekleyen talep yok." text="Web sitesinden ve danışan hesaplarından gelen yeni talepler burada listelenir." />
          </Card>
        ) : (
          <Card padded={false} style={{ overflow: 'hidden' }}>
            {items.map((a, i) => {
              const pilates = a.kind === 'PILATES';
              return (
                <View key={a.id} style={{ borderBottomWidth: i < items.length - 1 ? 1 : 0, borderBottomColor: colors.line }}>
                  <Pressable
                    onPress={() => router.push(`/panel/randevular/${a.id}`)}
                    accessibilityRole="button"
                    style={({ pressed }) => [{ padding: space.lg, gap: 4 }, pressed && { backgroundColor: '#F8F4EE' }]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                      <T variant="subheading" style={{ flex: 1 }} numberOfLines={1}>{displayName(a)}</T>
                      <StatusBadge status={a.status} />
                    </View>
                    <T variant="caption">{formatPhone(a.contactPhone)} · {relativeTime(a.createdAt)}</T>
                    <T variant="label" color={colors.cocoa}>
                      {pilates ? `Pilates · ${a.pilatesFormat ? PILATES_FORMAT_LABEL[a.pilatesFormat] : 'ders'}` : `Diyet${a.service ? ` · ${a.service.title}` : ''}`}
                    </T>
                    <T variant="caption">
                      {a.date ? `İstenen: ${formatDayStr(a.date, 'd MMM ccc')} ${a.time}` : pilates ? pilatesPreferenceText(a.preferredDays, a.preferredDayparts) : 'Saat seçilmedi, geri arama'}
                    </T>
                  </Pressable>
                  {canWrite ? (
                    <View style={{ flexDirection: 'row', gap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.md }}>
                      {a.date ? (
                        <Button title="Onayla" icon="check" size="sm" loading={busy(a, 'CONFIRMED')} onPress={() => void act(a, 'CONFIRMED')} />
                      ) : (
                        <Button title="Saat ata" icon="clock" size="sm" onPress={() => router.push(`/panel/randevular/${a.id}`)} />
                      )}
                      <Button title="Reddet" icon="x" size="sm" variant="secondary" loading={busy(a, 'CANCELLED')} onPress={() => void act(a, 'CANCELLED')} />
                    </View>
                  ) : null}
                </View>
              );
            })}
          </Card>
        )}
      </Section>

      <Section title="Diyet görüşmesi · boş saatler">
        <ConsultationAvailability refreshKey={refreshKey} />
      </Section>
      <Section title="Pilates">
        <PilatesAvailability refreshKey={refreshKey} />
      </Section>
    </Screen>
  );
}
