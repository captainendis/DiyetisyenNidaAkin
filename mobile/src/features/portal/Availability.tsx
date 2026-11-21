// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Önümüzdeki 14 gün: diyet görüşmesi boş saat sayıları + pilates boş yerleri (web: PortalAppointmentsPage → Availability).
 * Diğer danışanların bilgisi yok; yalnızca sayılar.
 */
import { ActivityIndicator, View } from 'react-native';
import type { PortalPilatesAvailability } from '@shared/portal';
import { Button, Card, RowBetween, Section, T } from '@/components/ui';
import { api, portalApi } from '@/lib/api';
import { addDays, formatDate, formatDayStr, formatTime, todayStr } from '@/lib/format';
import { useApiQuery } from '@/lib/query';
import { colors, radius, space } from '@/theme';
import { PK } from './util';

function Pending() {
  return <ActivityIndicator color={colors.gold} style={{ paddingVertical: space.lg }} />;
}

export function useAvailability() {
  const from = todayStr();
  const to = addDays(from, 13);
  const consult = useApiQuery(PK.consultDays(from), () => api.get<{ days: { date: string; available: number }[] }>('/public/availability/days', { from, to }));
  const pilates = useApiQuery(PK.pilatesAvailability, () => portalApi.get<PortalPilatesAvailability>('/pilates/availability'));
  return { consult, pilates };
}

export function Availability({ data, onConsult, onPilates }: { data: ReturnType<typeof useAvailability>; onConsult: () => void; onPilates: () => void }) {
  const { consult, pilates } = data;
  const openDays = consult.data?.days.filter((d) => d.available > 0) ?? [];
  return (
    <>
      <Section title="Diyet görüşmesi · boş saatler" action={<Button title="Talep et" variant="ghost" size="sm" onPress={onConsult} />}>
        <Card>
          {consult.error ? (
            <T variant="caption">Şu an yüklenemedi.</T>
          ) : !consult.data ? (
            <Pending />
          ) : openDays.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {openDays.map((d) => (
                <View key={d.date} style={{ backgroundColor: colors.cream, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 }}>
                  <T variant="caption" color={colors.text}>
                    {formatDayStr(d.date, 'd MMM ccc')} <T variant="caption">· {d.available} saat</T>
                  </T>
                </View>
              ))}
            </View>
          ) : (
            <T variant="caption" color={colors.cocoa}>Önümüzdeki iki haftada çevrim içi boş saat yok. Saat seçmeden talep bırakabilirsin.</T>
          )}
        </Card>
      </Section>
      <Section title="Pilates · boş yerler" action={<Button title="Talep et" variant="ghost" size="sm" onPress={onPilates} />}>
        <Card>
          {pilates.error ? (
            <T variant="caption">Şu an yüklenemedi.</T>
          ) : !pilates.data ? (
            <Pending />
          ) : pilates.data.groups.length || pilates.data.sessions.length ? (
            <View style={{ gap: space.md }}>
              {pilates.data.groups.map((g) => (
                <RowBetween key={g.id}>
                  <T numberOfLines={1} style={{ flex: 1 }}>{g.name}</T>
                  <T variant="label" color={colors.successInk}>{g.free} kişilik yer</T>
                </RowBetween>
              ))}
              {pilates.data.sessions.length > 0 ? (
                <View style={{ gap: 6 }}>
                  <T variant="label" color={colors.muted}>Boş yeri olan dersler</T>
                  {pilates.data.sessions.slice(0, 8).map((s) => (
                    <RowBetween key={s.id}>
                      <T variant="caption" color={colors.text} numberOfLines={1} style={{ flex: 1 }}>
                        {formatDate(s.startsAt)} {formatTime(s.startsAt)} · {s.title}
                      </T>
                      <T variant="caption">{s.free} yer</T>
                    </RowBetween>
                  ))}
                </View>
              ) : null}
            </View>
          ) : (
            <T variant="caption" color={colors.cocoa}>Gruplarda şu an boş yer yok. Talep bırakırsan yer açıldığında haber verilir.</T>
          )}
        </Card>
      </Section>
    </>
  );
}
