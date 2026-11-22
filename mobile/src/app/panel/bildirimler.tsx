// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Bildirimler — güne göre gruplu liste, okundu/okunmadı, silme, tümünü okundu işaretle, tür filtresi, kanal durumu.
 * Dokununca ilgili randevu ya da danışan açılır. Web: /panel/bildirimler (NotificationsPage).
 */
import { router, Stack } from 'expo-router';
import { DateTime } from 'luxon';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { NOTIFICATION_TYPE_LABEL, NOTIFICATION_TYPES, TIME_ZONE, type NotificationType } from '@shared/constants';
import { Badge, Button, Card, Empty, ErrorView, Icon, IconButton, Loading, Screen, Section, Segmented, SelectField, T, useToast, type IconName } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { formatTime } from '@/lib/format';
import { queryClient, useApiQuery } from '@/lib/query';
import { colors, fonts, space } from '@/theme';
import { Pager } from '@/features/appointments/ListView';

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  appointmentId: string | null;
  clientId: string | null;
  readAt: string | null;
  createdAt: string;
}
interface ListRes {
  items: Notification[];
  total: number;
  unread: number;
  page: number;
  pageSize: number;
}

const ICON: Record<NotificationType, IconName> = {
  APPOINTMENT_REQUESTED: 'calendar',
  APPOINTMENT_CONFIRMED: 'check-circle',
  APPOINTMENT_CANCELLED: 'x-circle',
  APPOINTMENT_UPCOMING: 'clock',
  CLIENT_CREATED: 'user-plus',
  CLIENT_DELETION_REQUESTED: 'user-minus',
};

function dayLabel(iso: string) {
  const d = DateTime.fromISO(iso).setZone(TIME_ZONE).startOf('day');
  const today = DateTime.now().setZone(TIME_ZONE).startOf('day');
  const diff = Math.round(today.diff(d, 'days').days);
  if (diff === 0) return 'Bugün';
  if (diff === 1) return 'Dün';
  return d.toFormat(d.year === today.year ? 'd MMMM, cccc' : 'd MMMM yyyy');
}

/** Bildirim listesi ve rozet sayısı birlikte tazelenir */
const refreshAll = () => queryClient.invalidateQueries({ queryKey: ['notifications'] });

export default function NotificationsScreen() {
  const toast = useToast();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [type, setType] = useState<'' | NotificationType>('');
  const [page, setPage] = useState(1);
  const key = ['notifications', 'list', filter, type, page] as const;
  const q = useApiQuery([...key], () => api.get<ListRes>('/notifications', { filter, type, page, pageSize: 30 }));
  const data = q.data;

  const groups = useMemo(() => {
    const out: { label: string; items: Notification[] }[] = [];
    for (const n of data?.items ?? []) {
      const l = dayLabel(n.createdAt);
      const g = out[out.length - 1];
      if (g?.label === l) g.items.push(n);
      else out.push({ label: l, items: [n] });
    }
    return out;
  }, [data]);

  /** İyimser güncelleme: listede hemen göster, sonra sunucudan tazele */
  const patchLocal = (id: string, readAt: string | null) =>
    queryClient.setQueryData<ListRes>([...key], (d) =>
      d
        ? {
            ...d,
            items: filter === 'unread' && readAt ? d.items.filter((x) => x.id !== id) : d.items.map((x) => (x.id === id ? { ...x, readAt } : x)),
            unread: Math.max(0, d.unread + (readAt ? -1 : 1)),
          }
        : d,
    );

  const toggleRead = async (n: Notification) => {
    const read = !n.readAt;
    try {
      await api.post(`/notifications/${n.id}/${read ? 'read' : 'unread'}`);
      patchLocal(n.id, read ? new Date().toISOString() : null);
      void refreshAll();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  const open = (n: Notification) => {
    if (!n.readAt) {
      patchLocal(n.id, new Date().toISOString());
      api.post(`/notifications/${n.id}/read`).then(refreshAll).catch(() => {});
    }
    if (n.appointmentId) router.push(`/panel/randevular/${n.appointmentId}`);
    else if (n.clientId) router.push(`/panel/danisanlar/${n.clientId}`);
  };

  const remove = async (n: Notification) => {
    try {
      await api.del(`/notifications/${n.id}`);
      queryClient.setQueryData<ListRes>([...key], (d) => (d ? { ...d, items: d.items.filter((x) => x.id !== n.id), total: d.total - 1, unread: d.unread - (n.readAt ? 0 : 1) } : d));
      toast('Bildirim silindi');
      void refreshAll();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  const [readingAll, setReadingAll] = useState(false);
  const readAll = async () => {
    setReadingAll(true);
    try {
      const r = await api.post<{ updated: number }>('/notifications/read-all');
      toast(r.updated ? `${r.updated} bildirim okundu olarak işaretlendi` : 'Okunmamış bildirim yok');
      await refreshAll();
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setReadingAll(false);
    }
  };

  return (
    <Screen refreshing={q.refreshing} onRefresh={q.refresh}>
      <Stack.Screen options={{ title: 'Bildirimler' }} />
      <View style={{ gap: space.md, marginBottom: space.xl }}>
        <T muted>{data ? (data.unread ? `${data.unread} okunmamış bildirim` : 'Tüm bildirimler okundu') : 'Randevu talepleri ve danışan kayıtları'}</T>
        <Button title="Tümünü okundu işaretle" icon="check-square" variant="secondary" size="sm" style={{ alignSelf: 'flex-start' }} loading={readingAll} disabled={!data?.unread} onPress={() => void readAll()} />
        <Segmented<'all' | 'unread'>
          value={filter}
          onChange={(v) => {
            setFilter(v);
            setPage(1);
          }}
          options={[
            { value: 'all', label: 'Tümü' },
            { value: 'unread', label: data?.unread ? `Okunmamış (${data.unread})` : 'Okunmamış' },
          ]}
        />
        <SelectField<'' | NotificationType>
          value={type}
          onChange={(v) => {
            setType(v);
            setPage(1);
          }}
          options={[{ value: '', label: 'Tüm türler' }, ...NOTIFICATION_TYPES.map((t) => ({ value: t, label: NOTIFICATION_TYPE_LABEL[t] }))]}
        />
      </View>

      {q.error ? (
        <ErrorView error={q.error} onRetry={() => void q.refetch()} />
      ) : !data ? (
        <Loading />
      ) : !data.items.length ? (
        <Empty
          icon="bell-off"
          title={filter === 'unread' ? 'Okunmamış bildirim yok.' : 'Henüz bildirim bulunmuyor.'}
          text="Web sitesinden yeni bir randevu talebi geldiğinde, randevular onaylandığında veya iptal edildiğinde burada görünür."
        />
      ) : (
        <>
          {groups.map((g) => (
            <Section key={g.label} title={g.label}>
              <Card padded={false} style={{ overflow: 'hidden' }}>
                {g.items.map((n, i) => {
                  const unread = !n.readAt;
                  const linked = !!(n.appointmentId || n.clientId);
                  return (
                    <View key={n.id} style={[styles.row, i < g.items.length - 1 && styles.line, unread && { backgroundColor: '#FBF3F0' }]}>
                      <View style={[styles.icon, { backgroundColor: unread ? colors.cocoa : '#F4EEE5' }]}>
                        <Icon name={ICON[n.type]} size={16} color={unread ? colors.rose : colors.cocoa} />
                      </View>
                      <Pressable
                        onPress={() => open(n)}
                        style={{ flex: 1, gap: 2 }}
                        accessibilityRole="button"
                        accessibilityLabel={`${n.title}${unread ? ' (okunmamış)' : ''}${linked ? ', ilgili kaydı aç' : ''}`}
                      >
                        <T style={{ fontFamily: unread ? fonts.bold : fonts.medium, fontSize: 14, color: colors.text }}>{n.title}</T>
                        {n.body ? <T variant="caption">{n.body}</T> : null}
                        <T variant="caption" style={{ fontSize: 12 }}>{formatTime(n.createdAt)} · {NOTIFICATION_TYPE_LABEL[n.type]}</T>
                      </Pressable>
                      <View style={{ gap: 2 }}>
                        <IconButton name={unread ? 'check' : 'circle'} label={unread ? 'Okundu işaretle' : 'Okunmadı işaretle'} color={colors.muted} onPress={() => void toggleRead(n)} />
                        <IconButton name="trash-2" label="Bildirimi sil" color={colors.muted} onPress={() => void remove(n)} />
                      </View>
                    </View>
                  );
                })}
              </Card>
            </Section>
          ))}
          <Pager page={data.page} pageSize={data.pageSize} total={data.total} onChange={setPage} />
        </>
      )}

      <ChannelStatus />
    </Screen>
  );
}

function ChannelStatus() {
  const q = useApiQuery(['notifications', 'channels'], () => api.get<{ channels: { key: 'EMAIL' | 'WHATSAPP'; configured: boolean }[] }>('/notifications/channels'), { staleTime: 5 * 60_000 });
  if (!q.data) return null;
  const meta: Record<'EMAIL' | 'WHATSAPP', { label: string; icon: IconName }> = { EMAIL: { label: 'E-posta', icon: 'mail' }, WHATSAPP: { label: 'WhatsApp', icon: 'message-circle' } };
  return (
    <Section title="Bildirim kanalları" style={{ marginTop: space.xl }}>
      <Card style={{ gap: space.md }}>
        <T variant="caption">Panel içi bildirimler her zaman aktiftir. Harici kanallar yapılandırılmadan hiçbir mesaj gönderilmez.</T>
        <View style={styles.channel}>
          <Icon name="bell" size={16} color={colors.successInk} />
          <T style={{ flex: 1 }}>Panel içi</T>
          <Badge label="Aktif" tone="success" />
        </View>
        {q.data.channels.map((c) => (
          <View key={c.key} style={styles.channel}>
            <Icon name={meta[c.key].icon} size={16} color={colors.muted} />
            <T style={{ flex: 1 }}>{meta[c.key].label}</T>
            <Badge label={c.configured ? 'Yapılandırıldı' : 'Yapılandırılmadı'} tone={c.configured ? 'success' : 'neutral'} />
          </View>
        ))}
      </Card>
    </Section>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingVertical: 12, paddingLeft: space.lg, paddingRight: space.sm },
  line: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  channel: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
