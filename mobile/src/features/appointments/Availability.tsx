// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Talepler ekranı: önümüzdeki 14 günün diyet görüşmesi boş saatleri ve pilates kontenjanı */
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { ClassGroupDTO, ClassSessionDTO } from '@shared/classes';
import { addDays, todayStr } from '@shared/time';
import { Card, ListItem, Loading, T } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDayStr } from '@/lib/format';
import { useApiQuery } from '@/lib/query';
import { colors, fonts, space } from '@/theme';

const DAYS_AHEAD = 14;

export function ConsultationAvailability({ refreshKey }: { refreshKey: number }) {
  const from = todayStr();
  const to = addDays(from, DAYS_AHEAD - 1);
  const q = useApiQuery(['appointments', 'availability-days', from], () => api.get<{ days: { date: string; available: number }[] }>('/public/availability/days', { from, to }));
  useEffect(() => {
    if (refreshKey) void q.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);
  if (q.error) return <Card><T muted>Müsaitlik yüklenemedi.</T></Card>;
  if (!q.data) return <Loading />;
  const max = Math.max(1, ...q.data.days.map((d) => d.available));
  const total = q.data.days.reduce((s, d) => s + d.available, 0);
  return (
    <Card padded={false} style={{ overflow: 'hidden' }}>
      <View style={styles.head}>
        <T variant="caption">{total} boş saat · {DAYS_AHEAD} gün</T>
      </View>
      {q.data.days.map((d) => (
        <Pressable
          key={d.date}
          onPress={() => router.push(`/panel/randevular?view=day&d=${d.date}`)}
          accessibilityRole="button"
          accessibilityLabel={`${formatDayStr(d.date, 'd MMMM cccc')}: ${d.available ? `${d.available} boş saat` : 'dolu'}`}
          style={({ pressed }) => [styles.dayRow, pressed && { backgroundColor: '#F8F4EE' }]}
        >
          <T style={{ width: 96, textTransform: 'capitalize' }}>{formatDayStr(d.date, 'd MMM ccc')}</T>
          <View style={styles.track}>
            {d.available ? <View style={[styles.fill, { width: `${(d.available / max) * 100}%` }]} /> : null}
          </View>
          <T style={{ width: 56, textAlign: 'right', fontFamily: d.available ? fonts.semibold : fonts.regular, color: d.available ? colors.text : colors.muted }}>
            {d.available ? `${d.available} saat` : 'dolu'}
          </T>
        </Pressable>
      ))}
      <View style={styles.foot}>
        <T variant="caption">Web sitesindeki randevu formunda görünen saatler. Çalışma saatleri “Çalışma Takvimi”nden değişir.</T>
      </View>
    </Card>
  );
}

export function PilatesAvailability({ refreshKey }: { refreshKey: number }) {
  const from = todayStr();
  const to = addDays(from, DAYS_AHEAD - 1);
  const q = useApiQuery(['classes', 'availability', from], async () => {
    const [groups, sessions] = await Promise.all([
      api.get<{ items: ClassGroupDTO[] }>('/classes/groups'),
      api.get<{ items: ClassSessionDTO[] }>('/classes/sessions', { from, to }),
    ]);
    return {
      groups: groups.items.filter((g) => g.isActive),
      sessions: sessions.items.filter((s) => s.status === 'SCHEDULED' && new Date(s.startsAt).getTime() > Date.now()),
    };
  });
  useEffect(() => {
    if (refreshKey) void q.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);
  if (q.error) return <Card><T muted>Müsaitlik yüklenemedi.</T></Card>;
  if (!q.data) return <Loading />;
  const open = q.data.sessions.filter((s) => s.seatsTaken < s.capacity).slice(0, 12);
  return (
    <View style={{ gap: space.md }}>
      <Card padded={false} style={{ overflow: 'hidden' }}>
        <View style={styles.head}>
          <T variant="label">Grup kontenjanı</T>
        </View>
        {q.data.groups.length ? (
          q.data.groups.map((g, i) => {
            const free = g.capacity - g.members.length;
            return (
              <ListItem
                key={g.id}
                title={g.name}
                last={i === q.data.groups.length - 1}
                meta={<T variant="label" color={free > 0 ? colors.successInk : colors.muted}>{free > 0 ? `${free} boş yer` : 'dolu'}</T>}
                onPress={() => router.push(`/panel/pilates/grup/${g.id}`)}
              />
            );
          })
        ) : (
          <View style={styles.foot}><T muted>Aktif grup yok.</T></View>
        )}
      </Card>
      <Card padded={false} style={{ overflow: 'hidden' }}>
        <View style={styles.head}>
          <T variant="label">Boş yeri olan dersler ({DAYS_AHEAD} gün)</T>
        </View>
        {open.length ? (
          open.map((s, i) => (
            <ListItem
              key={s.id}
              title={s.groupName ?? s.title}
              subtitle={`${formatDayStr(s.date, 'd MMM ccc')} ${s.time}`}
              last={i === open.length - 1}
              meta={<T variant="label" color={colors.successInk}>{s.capacity - s.seatsTaken} yer</T>}
              onPress={() => router.push(`/panel/pilates/ders/${s.id}`)}
            />
          ))
        ) : (
          <View style={styles.foot}><T muted>Önümüzdeki derslerde boş yer yok.</T></View>
        )}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { paddingHorizontal: space.lg, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, minHeight: 44 },
  track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#EDE6DB', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3, backgroundColor: colors.success },
  foot: { paddingHorizontal: space.lg, paddingVertical: space.md },
});
