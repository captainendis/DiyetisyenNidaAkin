// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Genel Bakış ("Bugün") — günün kararı: "Sıradaki kim, neyi onaylamam gerekiyor?"
 * Ajanda ve onay bekleyen talepler en üstte; istatistikler ve haftalık grafik destekleyici. Web: DashboardPage.
 */
import { router, type Href } from 'expo-router';
import { DateTime } from 'luxon';
import { Pressable, View } from 'react-native';
import { MEETING_TYPE_LABEL, TIME_ZONE } from '@shared/constants';
import { minutesOf, timeOf } from '@shared/time';
import { Badge, Button, Card, confirm, Empty, ErrorView, Icon, Loading, Screen, Section, T, useToast, type IconName } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useStaff } from '@/lib/auth';
import { formatDayStr, formatPhone, relativeTime } from '@/lib/format';
import { useApiMutation, useApiQuery } from '@/lib/query';
import { colors, radius, space } from '@/theme';
import { AppointmentRow } from '@/features/appointments/AppointmentRow';
import { APPOINTMENT_INVALIDATE, displayName, type AppointmentDTO } from '@/features/appointments/types';
import { SetupChecklist } from '@/features/dashboard/SetupChecklist';
import { StatCard } from '@/features/dashboard/StatCard';
import { WeeklyChart } from '@/features/dashboard/WeeklyChart';
import type { Agenda, DashboardStats, Weekly } from '@/features/dashboard/types';

export default function DashboardScreen() {
  const { user, can } = useStaff();
  const toast = useToast();
  const canWrite = can('appointments:write');
  const stats = useApiQuery(['dashboard', 'stats'], () => api.get<DashboardStats>('/dashboard/stats'));
  const agenda = useApiQuery(['dashboard', 'agenda'], () => api.get<Agenda>('/dashboard/agenda'));
  const weekly = useApiQuery(['dashboard', 'weekly'], () => api.get<Weekly>('/dashboard/weekly'));

  const now = DateTime.now().setZone(TIME_ZONE);
  const nowStr = now.toFormat('HH:mm');
  const hello = user.salutation || user.firstName;
  const nextId = agenda.data?.items.find((a) => (a.status === 'CONFIRMED' || a.status === 'PENDING') && a.time && timeOf(minutesOf(a.time) + (a.durationMinutes ?? 0)) > nowStr)?.id;

  const quick = useApiMutation(
    ({ a, status }: { a: AppointmentDTO; status: 'CONFIRMED' | 'CANCELLED' }) =>
      api.post(`/appointments/${a.id}/status`, { status, note: status === 'CANCELLED' ? 'Genel bakıştan reddedildi' : null }),
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
  const open = (id: string) => router.push(`/panel/randevular/${id}`);

  const refreshing = stats.refreshing || agenda.refreshing || weekly.refreshing;
  const onRefresh = () => {
    void stats.refresh();
    void agenda.refresh();
    void weekly.refresh();
  };
  const c = stats.data?.cards;
  const series = (k: keyof NonNullable<typeof c>) => c?.[k].series.map((s) => s.value) ?? [];

  const quickLinks: { to: Href; label: string; icon: IconName; ok: boolean }[] = [
    { to: '/panel/danisanlar/yeni', label: 'Yeni danışan ekle', icon: 'user-plus', ok: can('clients:write') },
    { to: '/panel/randevular/yeni', label: 'Yeni randevu oluştur', icon: 'calendar', ok: canWrite },
    { to: '/panel/randevular?view=week', label: 'Takvimi görüntüle', icon: 'grid', ok: can('appointments:read') },
    { to: '/panel/danisanlar', label: 'Danışan listesini aç', icon: 'users', ok: can('clients:read') },
  ];

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh} title={`Merhaba, ${hello}`} subtitle={`${now.toFormat('d MMMM yyyy, cccc')} · Bugünkü danışan ve randevu durumunuz.`}>
      {can('content:write') ? <SetupChecklist /> : null}

      <Section
        title={agenda.data ? `Bugünün ajandası · ${agenda.data.items.filter((a) => a.status !== 'CANCELLED').length} randevu` : 'Bugünün ajandası'}
        action={<Button title="Gün görünümü" variant="ghost" size="sm" onPress={() => router.push('/panel/randevular?view=day')} />}
      >
        {agenda.error ? (
          <ErrorView error={agenda.error} onRetry={() => void agenda.refetch()} />
        ) : !agenda.data ? (
          <Loading />
        ) : !agenda.data.items.length ? (
          <Card>
            <Empty
              icon="calendar"
              title="Bugün için planlanmış randevunuz bulunmuyor."
              text="Yeni bir randevu oluşturabilir veya bekleyen talepleri gözden geçirebilirsiniz."
              action={canWrite ? <Button title="Yeni randevu" icon="plus" variant="secondary" size="sm" onPress={() => router.push('/panel/randevular/yeni')} /> : undefined}
            />
          </Card>
        ) : (
          <Card padded={false} style={{ overflow: 'hidden' }}>
            {agenda.data.items.map((a, i) => (
              <AppointmentRow key={a.id} appointment={a} highlight={a.id === nextId} last={i === agenda.data!.items.length - 1} onPress={() => open(a.id)} />
            ))}
          </Card>
        )}
      </Section>

      <Section
        title="Onay bekleyen talepler"
        action={
          agenda.data && agenda.data.pendingTotal > agenda.data.pendingRequests.length ? (
            <Button title={`Tümü (${agenda.data.pendingTotal})`} variant="ghost" size="sm" onPress={() => router.push('/panel/randevular?view=list&status=PENDING&status=NEW_REQUEST')} />
          ) : agenda.data?.pendingTotal ? (
            <Badge label={String(agenda.data.pendingTotal)} tone="warning" />
          ) : undefined
        }
      >
        {agenda.error ? null : !agenda.data ? (
          <Loading />
        ) : !agenda.data.pendingRequests.length ? (
          <Card>
            <Empty icon="inbox" title="Bekleyen talep yok" text="Yeni bir randevu talebi geldiğinde burada ve bildirimlerde görünür." />
          </Card>
        ) : (
          <Card padded={false} style={{ overflow: 'hidden', borderColor: colors.warning }}>
            {agenda.data.pendingRequests.map((a, i) => (
              <View key={a.id} style={{ padding: space.lg, gap: space.sm, borderBottomWidth: i < agenda.data!.pendingRequests.length - 1 ? 1 : 0, borderBottomColor: colors.line }}>
                <Pressable onPress={() => open(a.id)} accessibilityRole="button" style={{ gap: 2 }}>
                  <T variant="subheading">{displayName(a)}</T>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Icon name="clock" size={13} color={colors.muted} />
                    <T variant="caption" style={{ flex: 1 }}>
                      {a.date ? `${formatDayStr(a.date, 'd MMM ccc')} · ${a.time}` : 'Saat seçilmedi (geri arama)'} · {MEETING_TYPE_LABEL[a.meetingType]}
                    </T>
                  </View>
                  <T variant="caption">{formatPhone(a.contactPhone)} · {relativeTime(a.createdAt)} geldi</T>
                </Pressable>
                {canWrite ? (
                  <View style={{ flexDirection: 'row', gap: space.sm }}>
                    {a.date ? (
                      <Button title="Onayla" icon="check" size="sm" loading={busy(a, 'CONFIRMED')} onPress={() => void act(a, 'CONFIRMED')} />
                    ) : (
                      <Button title="Saat ata" size="sm" onPress={() => open(a.id)} />
                    )}
                    <Button title="Reddet" icon="x" size="sm" variant="secondary" loading={busy(a, 'CANCELLED')} onPress={() => void act(a, 'CANCELLED')} />
                  </View>
                ) : null}
              </View>
            ))}
          </Card>
        )}
      </Section>

      <Section title="İstatistikler">
        {stats.error ? (
          <ErrorView error={stats.error} onRetry={() => void stats.refetch()} />
        ) : !c ? (
          <Loading />
        ) : (
          <View style={{ gap: space.md }}>
            <View style={{ flexDirection: 'row', gap: space.md }}>
              <StatCard
                label="Bugünkü randevular"
                value={c.today.value}
                definition="Bugün için planlanmış, iptal edilmemiş randevular (onaylı, onay bekleyen, tamamlanan, gelmedi)."
                comparison={`${c.today.comparison.label}: ${c.today.comparison.value}`}
                series={series('today')}
                seriesLabel="Son 7 günün günlük randevu sayısı"
              />
              <StatCard
                label="Bekleyen randevular"
                value={c.pending.value}
                definition="Şu anda “Onay Bekliyor” veya “Yeni Talep” durumundaki kayıtlar. Çizgi: son 7 günde web sitesinden gelen talepler."
                comparison={`Son 7 günde ${c.pending.comparison.current ?? 0} web talebi · önceki 7 gün: ${c.pending.comparison.value}`}
                series={series('pending')}
                seriesLabel="Son 7 günde gelen web talepleri"
              />
            </View>
            <View style={{ flexDirection: 'row', gap: space.md }}>
              <StatCard
                label="Toplam danışan"
                value={c.clients.value}
                definition="Aktif ve pasif durumdaki danışan kayıtları (arşivlenenler hariç). Çizgi: son 7 günde eklenen danışanlar."
                comparison={`Bu ay ${c.clients.comparison.current ?? 0} yeni · geçen ay: ${c.clients.comparison.value}`}
                series={series('clients')}
                seriesLabel="Son 7 günde eklenen danışanlar"
              />
              <StatCard
                label="Bu ayki görüşmeler"
                value={c.month.value}
                definition="Bu takvim ayındaki onaylı ve tamamlanmış randevular (gelecek tarihli onaylılar dahil)."
                comparison={`${c.month.comparison.label}: ${c.month.comparison.value}`}
                series={series('month')}
                seriesLabel="Son 7 günün onaylı ve tamamlanan görüşmeleri"
              />
            </View>
          </View>
        )}
      </Section>

      <Section title="Son 7 gün: randevular nasıl sonuçlandı?">
        <Card>
          {weekly.error ? (
            <ErrorView error={weekly.error} onRetry={() => void weekly.refetch()} />
          ) : !weekly.data ? (
            <Loading />
          ) : weekly.data.days.every((d) => d.completed + d.cancelled + d.open === 0) ? (
            <Empty icon="bar-chart-2" title="Son 7 günde randevu kaydı yok" text="Randevular tamamlandıkça veya iptal edildikçe dağılım burada görünür." />
          ) : (
            <View style={{ gap: space.sm }}>
              <T variant="caption">Randevu tarihine göre, günlük</T>
              <WeeklyChart days={weekly.data.days} />
            </View>
          )}
        </Card>
      </Section>

      <Section title="Hızlı işlemler">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
          {quickLinks
            .filter((x) => x.ok)
            .map((x) => (
              <Pressable
                key={x.label}
                onPress={() => router.push(x.to)}
                accessibilityRole="button"
                style={({ pressed }) => [
                  { width: '47%', flexGrow: 1, gap: space.md, padding: space.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
                  pressed && { backgroundColor: '#F8F4EE' },
                ]}
              >
                <Icon name={x.icon} size={20} color={colors.goldInk} />
                <T variant="label">{x.label}</T>
              </Pressable>
            ))}
        </View>
      </Section>
    </Screen>
  );
}
