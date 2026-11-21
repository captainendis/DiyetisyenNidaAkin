// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Ders detayı: katılımcılar ve yoklama (katıldı / gelmedi / haber verdi), telafi-misafir ekleme,
 * zaman/kontenjan düzenleme, yapıldı / iptal / yeniden planla / sil. (Web: SessionModal)
 */
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Badge, Button, Card, confirm, IconButton, Notice, QueryView, Screen, Section, T, useToast } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { formatDayStr } from '@/lib/format';
import { queryClient, useApiQuery } from '@/lib/query';
import { useStaff } from '@/lib/auth';
import { space } from '@/theme';
import type { ClassAttendanceStatus } from '@shared/constants';
import { AttendeeRow } from '@/features/classes/AttendeeRow';
import { ClientPicker } from '@/features/classes/ClientPicker';
import { SessionEditSheet } from '@/features/classes/SessionEditSheet';
import { classKeys, clientName, SeatDots, SessionStatusBadge, timeRange, type ClassSessionDTO } from '@/features/classes/shared';

type Res = { session: ClassSessionDTO };

export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { can } = useStaff();
  const canWrite = can('appointments:write');
  const toast = useToast();
  const q = useApiQuery(classKeys.session(id), () => api.get<Res>(`/classes/sessions/${id}`));
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const apply = (s: ClassSessionDTO) => {
    queryClient.setQueryData(classKeys.session(id), { session: s });
    void queryClient.invalidateQueries({ queryKey: ['classes'], predicate: (qq) => qq.queryKey[1] !== 'session' });
  };

  /** Ortak mutasyon: yanıtla gelen dersi yerinde günceller */
  const run = async (key: string, fn: () => Promise<Res>, ok?: string) => {
    setBusy(key);
    try {
      const r = await fn();
      apply(r.session);
      if (ok) toast(ok);
      return true;
    } catch (e) {
      toast(errorMessage(e), 'error');
      return false;
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Ders',
          headerRight: canWrite && q.data ? () => <IconButton name="edit-2" label="Dersi düzenle" onPress={() => setEditing(true)} /> : undefined,
        }}
      />
      <QueryView query={q}>
      {({ session: s }) => {
        const started = new Date(s.startsAt).getTime() <= Date.now();
        const editable = canWrite && s.status !== 'CANCELLED';

        const mark = (clientId: string, status: ClassAttendanceStatus) =>
          run(`m-${clientId}`, () => api.patch<Res>(`/classes/sessions/${s.id}/attendees/${clientId}`, { status }));
        const remove = async (clientId: string, name: string) => {
          const ok = await confirm({ title: `${name} bu dersten çıkarılsın mı?`, message: 'Grup üyeliği değişmez; yalnızca bu dersin listesinden çıkar.', confirmText: 'Çıkar', destructive: true });
          if (ok) await run(`m-${clientId}`, () => api.del<Res>(`/classes/sessions/${s.id}/attendees/${clientId}`));
        };
        const setStatus = async (status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED') => {
          if (status === 'CANCELLED') {
            const ok = await confirm({ title: 'Ders iptal edilsin mi?', message: 'Saat takvimde boşalır. Katılımcılara ayrıca haber vermeyi unutmayın.', confirmText: 'Dersi iptal et', destructive: true });
            if (!ok) return;
          }
          if (status === 'COMPLETED') {
            const ok = await confirm({ title: 'Ders yapıldı olarak işaretlensin mi?', message: 'İşaretlenmemiş katılımcılar “katıldı” sayılır.', confirmText: 'Ders yapıldı' });
            if (!ok) return;
          }
          const msg = { SCHEDULED: 'Ders yeniden planlandı', COMPLETED: 'Ders yapıldı olarak işaretlendi', CANCELLED: 'Ders iptal edildi' }[status];
          await run(`s-${status}`, () => api.post<Res>(`/classes/sessions/${s.id}/status`, { status }), msg);
        };
        const destroy = async () => {
          const ok = await confirm({ title: 'Ders silinsin mi?', message: 'Ders ve katılım listesi kalıcı olarak silinir.', confirmText: 'Sil', destructive: true });
          if (!ok) return;
          setBusy('delete');
          try {
            await api.del(`/classes/sessions/${s.id}`);
            toast('Ders silindi');
            void queryClient.invalidateQueries({ queryKey: ['classes'], predicate: (qq) => qq.queryKey[1] !== 'session' });
            router.back();
          } catch (e) {
            toast(errorMessage(e), 'error');
          } finally {
            setBusy(null);
          }
        };

        const footer = canWrite ? (
          <View style={{ gap: space.sm }}>
            {s.status === 'SCHEDULED' ? (
              <>
                <Button
                  title="Ders yapıldı"
                  icon="check-circle"
                  full
                  loading={busy === 's-COMPLETED'}
                  disabled={!started}
                  onPress={() => void setStatus('COMPLETED')}
                />
                {!started ? <T variant="caption" center>Ders başladıktan sonra “yapıldı” işaretlenebilir.</T> : null}
              </>
            ) : null}
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              {s.status !== 'COMPLETED' ? (
                <Button title="Sil" icon="trash-2" variant="danger" loading={busy === 'delete'} onPress={() => void destroy()} style={{ flex: 1 }} />
              ) : null}
              {s.status === 'SCHEDULED' ? (
                <Button title="İptal et" icon="slash" variant="secondary" loading={busy === 's-CANCELLED'} onPress={() => void setStatus('CANCELLED')} style={{ flex: 1 }} />
              ) : (
                <Button
                  title={s.status === 'CANCELLED' ? 'Yeniden planla' : 'Yapıldı işaretini geri al'}
                  icon="rotate-ccw"
                  variant="secondary"
                  loading={busy === 's-SCHEDULED'}
                  onPress={() => void setStatus('SCHEDULED')}
                  style={{ flex: 2 }}
                />
              )}
            </View>
          </View>
        ) : undefined;

        return (
          <Screen refreshing={q.refreshing} onRefresh={q.refresh} footer={footer}>
            <Card style={{ gap: space.sm, marginBottom: space.xl }}>
              <T variant="title">{s.title}</T>
              <T muted>
                {formatDayStr(s.date, 'd MMMM yyyy, cccc')} · {timeRange(s.time, s.durationMinutes)}
              </T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm, marginTop: 4 }}>
                <SessionStatusBadge status={s.status} />
                <SeatDots taken={s.seatsTaken} capacity={s.capacity} />
                {s.groupName ? <Badge label={`Grup: ${s.groupName}`} tone="neutral" /> : <Badge label="Tek seferlik ders" tone="gold" />}
              </View>
              {s.groupId ? (
                <Button title="Grubu aç" icon="users" variant="ghost" size="sm" onPress={() => router.push(`/panel/pilates/grup/${s.groupId}`)} style={{ alignSelf: 'flex-start' }} />
              ) : null}
              {s.note ? (
                <View style={{ backgroundColor: '#F4EEE5', borderRadius: 10, padding: space.md, marginTop: 4 }}>
                  <T>{s.note}</T>
                </View>
              ) : null}
            </Card>

            <Section title={`Katılımcılar · ${s.seatsTaken}/${s.capacity}`}>
              {s.attendees.length === 0 ? (
                <Card>
                  <T muted center>Bu derste henüz kimse yok.</T>
                </Card>
              ) : (
                <Card padded={false}>
                  {s.attendees.map((a, i) => (
                    <AttendeeRow
                      key={a.clientId}
                      a={a}
                      editable={editable}
                      started={started}
                      busy={busy === `m-${a.clientId}`}
                      last={i === s.attendees.length - 1}
                      onMark={(st) => void mark(a.clientId, st)}
                      onRemove={() => void remove(a.clientId, clientName(a.client))}
                    />
                  ))}
                </Card>
              )}
              {editable && !started && s.attendees.length > 0 ? (
                <T variant="caption" style={{ marginTop: space.sm }}>“Katıldı” ve “Gelmedi” ders başladıktan sonra işaretlenebilir. Tekrar dokunmak kaydı “kayıtlı” durumuna döndürür.</T>
              ) : null}
            </Section>

            {editable ? (
              <Section title="Telafi / misafir">
                {s.seatsTaken < s.capacity ? (
                  <Card>
                    <ClientPicker
                      hideCount
                      label="Derse kişi ekle"
                      value={[]}
                      max={1}
                      disabled={busy === 'add'}
                      exclude={s.attendees.filter((a) => a.status !== 'EXCUSED').map((a) => a.clientId)}
                      onChange={(v) => {
                        const c = v[0];
                        if (c) void run('add', () => api.post<Res>(`/classes/sessions/${s.id}/attendees`, { clientId: c.id }), `${clientName(c)} derse eklendi`);
                      }}
                      hint={`${s.capacity - s.seatsTaken} kişilik yer var. “Haber verdi” işaretlenen kişinin yeri boşalır.`}
                    />
                  </Card>
                ) : (
                  <Notice tone="neutral" icon="calendar" text="Ders dolu. Haber veren olursa “Haber verdi” işaretleyin; yeri telafi için açılır." />
                )}
              </Section>
            ) : null}

            {canWrite ? <SessionEditSheet session={s} visible={editing} onClose={() => setEditing(false)} onSaved={(n) => { apply(n); setEditing(false); toast('Ders güncellendi'); }} /> : null}
          </Screen>
        );
      }}
      </QueryView>
    </>
  );
}
