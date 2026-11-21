// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Pilates grubu: özet, üyeler, yaklaşan dersler, grup açıklaması ve not defteri.
 * İşlemler (appointments:write): düzenle, ders programı / tek ders ekle, pasife al / aktifleştir, sil.
 */
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Badge, Button, Card, confirm, IconButton, ListItem, QueryView, Screen, Section, Sheet, T, useToast } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { addDays, formatDateTime, formatDayStr, todayStr } from '@/lib/format';
import { queryClient, useApiQuery } from '@/lib/query';
import { useStaff } from '@/lib/auth';
import { space } from '@/theme';
import { NoteBook } from '@/features/classes/NoteBook';
import { classKeys, clientName, patternLabel, SeatDots, SessionStatusBadge, timeRange, type ClassGroupDTO, type ClassSessionDTO } from '@/features/classes/shared';

export default function GroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { can } = useStaff();
  const canWrite = can('appointments:write');
  const toast = useToast();
  const [menu, setMenu] = useState(false);
  const q = useApiQuery(['classes', 'group', id], () => api.get<{ group: ClassGroupDTO }>(`/classes/groups/${id}`));
  const from = todayStr();
  const to = addDays(from, 56);
  const upcoming = useApiQuery(classKeys.sessions(from, to, { groupId: id }), () => api.get<{ items: ClassSessionDTO[] }>('/classes/sessions', { from, to, groupId: id }));

  const refresh = async () => {
    await Promise.all([q.refresh(), upcoming.refresh(), queryClient.invalidateQueries({ queryKey: classKeys.notes(id) })]);
  };

  const toggle = async (g: ClassGroupDTO) => {
    setMenu(false);
    try {
      await api.patch(`/classes/groups/${g.id}`, { isActive: !g.isActive });
      toast(
        g.isActive
          ? g.upcomingCount
            ? `Grup pasife alındı. ${g.upcomingCount} planlı ders takvimde kalır; gerekirse dersleri iptal edin.`
            : 'Grup pasife alındı'
          : 'Grup aktifleştirildi',
      );
      await queryClient.invalidateQueries({ queryKey: ['classes'] });
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };
  const remove = async (g: ClassGroupDTO) => {
    setMenu(false);
    const ok = await confirm({
      title: `“${g.name}” silinsin mi?`,
      message: 'Geçmiş dersler ve katılım kayıtları korunur; grup, üyelik listesi ve grubun not defteri silinir.',
      confirmText: 'Grubu sil',
      destructive: true,
    });
    if (!ok) return;
    try {
      await api.del(`/classes/groups/${g.id}`);
      toast('Grup silindi');
      void queryClient.invalidateQueries({ queryKey: ['classes'], predicate: (qq) => !(qq.queryKey[1] === 'group' && qq.queryKey[2] === id) && !(qq.queryKey[1] === 'notes' && qq.queryKey[2] === id) });
      router.back();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: q.data?.group.name ?? 'Grup',
          headerRight:
            canWrite && q.data
              ? () => (
                  <View style={{ flexDirection: 'row', gap: space.sm }}>
                    <IconButton name="edit-2" label="Grubu düzenle" onPress={() => router.push(`/panel/pilates/grup/duzenle?id=${id}`)} />
                    <IconButton name="more-horizontal" label="Grup işlemleri" onPress={() => setMenu(true)} />
                  </View>
                )
              : undefined,
        }}
      />
      <QueryView query={q}>
        {({ group: g }) => (
          <Screen refreshing={q.refreshing} onRefresh={() => void refresh()}>
            <Card style={{ gap: space.sm, marginBottom: space.xl }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
                <T variant="title">{g.name}</T>
                {!g.isActive ? <Badge label="Pasif" tone="neutral" /> : null}
              </View>
              <T muted>
                {g.pattern.length ? patternLabel(g.pattern) : 'Planlı ders yok'} · {g.defaultDurationMinutes} dk
              </T>
              <SeatDots taken={g.members.length} capacity={g.capacity} />
              {canWrite && g.isActive ? (
                <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.sm }}>
                  <Button title="Ders programı" icon="repeat" size="sm" onPress={() => router.push(`/panel/pilates/program?groupId=${g.id}`)} style={{ flex: 1 }} />
                  <Button title="Tek ders" icon="plus" size="sm" variant="secondary" onPress={() => router.push(`/panel/pilates/ders/yeni?groupId=${g.id}`)} style={{ flex: 1 }} />
                </View>
              ) : null}
            </Card>

            <Section title={`Üyeler · ${g.members.length}/${g.capacity}`}>
              {g.members.length ? (
                <Card padded={false}>
                  {g.members.map((m, i) => (
                    <ListItem key={m.id} icon="user" title={clientName(m)} onPress={() => router.push(`/panel/danisanlar/${m.id}`)} last={i === g.members.length - 1} />
                  ))}
                </Card>
              ) : (
                <T muted>Üye eklenmedi.</T>
              )}
            </Section>

            <Section title="Yaklaşan dersler">
              <T variant="caption" style={{ marginBottom: space.sm }}>
                {g.nextSession ? `Sonraki: ${formatDateTime(g.nextSession.startsAt)} · ${g.upcomingCount} planlı` : 'Planlı ders yok.'}
              </T>
              {upcoming.data?.items.length ? (
                <Card padded={false}>
                  {upcoming.data.items.slice(0, 12).map((s, i, arr) => (
                    <ListItem
                      key={s.id}
                      icon="calendar"
                      title={`${formatDayStr(s.date, 'd MMMM cccc')}`}
                      subtitle={`${timeRange(s.time, s.durationMinutes)} · ${s.seatsTaken}/${s.capacity} kişi`}
                      right={s.status !== 'SCHEDULED' ? <SessionStatusBadge status={s.status} /> : undefined}
                      onPress={() => router.push(`/panel/pilates/ders/${s.id}`)}
                      last={i === arr.length - 1}
                    />
                  ))}
                </Card>
              ) : null}
            </Section>

            {g.note ? (
              <Section title="Grup açıklaması">
                <Card>
                  <T>{g.note}</T>
                </Card>
              </Section>
            ) : null}

            <Section title="Not defteri">
              <NoteBook groupId={g.id} canWrite={canWrite} />
            </Section>

            {canWrite ? (
              <Sheet visible={menu} onClose={() => setMenu(false)} title="Grup işlemleri">
                <Card padded={false}>
                  <ListItem icon="power" title={g.isActive ? 'Pasife al' : 'Aktifleştir'} onPress={() => void toggle(g)} />
                  <ListItem icon="trash-2" title="Grubu sil" danger onPress={() => void remove(g)} last />
                </Card>
              </Sheet>
            ) : null}
          </Screen>
        )}
      </QueryView>
    </>
  );
}
