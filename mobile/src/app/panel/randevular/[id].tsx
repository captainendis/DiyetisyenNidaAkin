// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Randevu detayı — durum işlemleri, yeniden planlama, WhatsApp mesajı, dahili not, durum geçmişi.
 * Web: AppointmentDetailModal (/panel/randevular?id=…)
 */
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';
import { APPOINTMENT_STATUS_LABEL, MEETING_TYPE_LABEL, PILATES_FORMAT_LABEL, pilatesPreferenceText, type AppointmentStatus } from '@shared/constants';
import { Button, Card, confirm, KeyValue, ListItem, Notice, QueryView, Screen, Section, T, TextField, useToast } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useStaff } from '@/lib/auth';
import { formatDateTime, formatDayStr, formatPhone, relativeTime } from '@/lib/format';
import { useApiMutation, useApiQuery } from '@/lib/query';
import { space } from '@/theme';
import { StatusBadge } from '@/features/appointments/AppointmentRow';
import { ReasonSheet, RescheduleSheet, StatusHistory } from '@/features/appointments/DetailParts';
import { WhatsappWrite } from '@/features/appointments/WhatsappWrite';
import { APPOINTMENT_INVALIDATE, displayName, TRANSITIONS, type AppointmentDetail } from '@/features/appointments/types';

interface Op {
  key: string;
  fn: () => Promise<unknown>;
  msg: string;
}

export default function AppointmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useApiQuery(['appointments', 'detail', id], () => api.get<{ appointment: AppointmentDetail }>(`/appointments/${id}`).then((r) => r.appointment), { enabled: !!id });
  return (
    <>
      <Stack.Screen options={{ title: q.data ? displayName(q.data) : 'Randevu' }} />
      <QueryView query={q}>{(a) => <Detail a={a} refreshing={q.refreshing} onRefresh={q.refresh} />}</QueryView>
    </>
  );
}

function Detail({ a, refreshing, onRefresh }: { a: AppointmentDetail; refreshing: boolean; onRefresh: () => void }) {
  const toast = useToast();
  const { can } = useStaff();
  const canWrite = can('appointments:write');
  const [sheet, setSheet] = useState<null | 'reject' | 'cancel' | 'reschedule'>(null);
  const [note, setNote] = useState(a.internalNote ?? '');
  useEffect(() => setNote(a.internalNote ?? ''), [a.internalNote]);

  const op = useApiMutation((p: Op) => p.fn(), {
    invalidate: APPOINTMENT_INVALIDATE,
    onSuccess: (_, p) => {
      toast(p.msg);
      setSheet(null);
    },
  });
  const run = (p: Op) => op.mutate(p, { onError: (e) => toast(errorMessage(e), 'error') });
  const busy = (key: string) => op.isPending && op.variables?.key === key;

  const setStatus = (status: AppointmentStatus, msg: string, n?: string) =>
    run({ key: status, fn: () => api.post(`/appointments/${a.id}/status`, { status, note: n?.trim() || null }), msg });

  const confirmFinal = async (status: AppointmentStatus, title: string, message: string, msg: string) => {
    if (await confirm({ title, message, confirmText: APPOINTMENT_STATUS_LABEL[status], destructive: status === 'NO_SHOW' })) setStatus(status, msg);
  };

  const remove = async () => {
    const ok = await confirm({
      title: 'Randevu silinsin mi?',
      message: 'Bu işlem geri alınamaz. Kaydı saklamak istiyorsanız silmek yerine “İptal et” seçeneğini kullanın.',
      confirmText: 'Kalıcı olarak sil',
      destructive: true,
    });
    if (!ok) return;
    op.mutate(
      { key: 'delete', fn: () => api.del(`/appointments/${a.id}`), msg: 'Randevu silindi' },
      { onSuccess: () => router.back(), onError: (e) => toast(errorMessage(e), 'error') },
    );
  };

  const allowed = TRANSITIONS[a.status];
  const name = displayName(a);
  const openUrl = (url: string) => Linking.openURL(url).catch(() => toast('Bağlantı açılamadı', 'error'));

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <View style={{ gap: 6, marginBottom: space.lg }}>
        <T variant="title">{name}</T>
        <T muted style={{ textTransform: 'capitalize' }}>{a.date ? `${formatDayStr(a.date, 'd MMMM yyyy, cccc')} · ${a.time}` : 'Saat seçilmemiş geri arama talebi'}</T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
          <StatusBadge status={a.status} />
          <T variant="caption">{a.source === 'WEBSITE' ? 'Web sitesinden talep' : 'Panelden oluşturuldu'} · {relativeTime(a.createdAt)}</T>
        </View>
      </View>

      {canWrite && a.status !== 'COMPLETED' ? (
        <Section title="İşlemler">
          <View style={{ gap: space.sm }}>
            {allowed.includes('CONFIRMED') && a.date ? (
              <Button
                title={a.status === 'CANCELLED' || a.status === 'NO_SHOW' ? 'Yeniden onayla' : 'Onayla'}
                icon="check"
                loading={busy('CONFIRMED')}
                onPress={() => setStatus('CONFIRMED', 'Randevu onaylandı')}
              />
            ) : null}
            {a.status !== 'NO_SHOW' ? (
              <Button title={a.date ? 'Tarihi / saati değiştir' : 'Tarih ve saat ata'} icon="clock" variant={a.date ? 'secondary' : 'primary'} onPress={() => setSheet('reschedule')} />
            ) : null}
            <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
              {allowed.includes('COMPLETED') ? (
                <Button
                  title="Tamamlandı"
                  icon="check-circle"
                  variant="secondary"
                  style={{ flexGrow: 1 }}
                  loading={busy('COMPLETED')}
                  onPress={() => void confirmFinal('COMPLETED', 'Görüşme tamamlandı olarak işaretlensin mi?', `${name} ile görüşme tamamlandı olarak kaydedilecek.`, 'Tamamlandı olarak işaretlendi')}
                />
              ) : null}
              {allowed.includes('NO_SHOW') ? (
                <Button
                  title="Gelmedi"
                  icon="user-x"
                  variant="secondary"
                  style={{ flexGrow: 1 }}
                  loading={busy('NO_SHOW')}
                  onPress={() => void confirmFinal('NO_SHOW', 'Danışan gelmedi olarak işaretlensin mi?', 'Bu kayıt raporlarda “Gelmedi” olarak görünür.', 'Gelmedi olarak işaretlendi')}
                />
              ) : null}
              {a.status === 'PENDING' || a.status === 'NEW_REQUEST' ? (
                <Button title="Reddet" icon="x" variant="danger" style={{ flexGrow: 1 }} onPress={() => setSheet('reject')} />
              ) : null}
              {a.status === 'CONFIRMED' ? <Button title="İptal et" icon="x-circle" variant="danger" style={{ flexGrow: 1 }} onPress={() => setSheet('cancel')} /> : null}
            </View>
          </View>
        </Section>
      ) : null}

      <Section>
        <WhatsappWrite a={a} name={name} />
      </Section>

      <Section title="İletişim">
        <Card padded={false}>
          {a.client ? (
            <ListItem icon="user" title={name} subtitle="Danışan profiline git" onPress={() => router.push(`/panel/danisanlar/${a.client!.id}`)} />
          ) : (
            <ListItem icon="user" title={a.contactName} subtitle="Danışan kaydı onayla oluşturulur" />
          )}
          <ListItem icon="phone" title={formatPhone(a.contactPhone)} subtitle="Ara" onPress={() => void openUrl(`tel:${a.contactPhone.replace(/\s/g, '')}`)} />
          {a.contactEmail ? (
            <ListItem icon="mail" title={a.contactEmail} subtitle="E-posta gönder" last onPress={() => void openUrl(`mailto:${a.contactEmail}`)} />
          ) : (
            <ListItem icon="mail" title="E-posta belirtilmedi" last />
          )}
        </Card>
      </Section>

      <Section title="Randevu">
        <Card style={{ paddingVertical: space.xs }}>
          <KeyValue label="Tarih ve saat" value={a.date ? `${formatDayStr(a.date, 'd MMMM yyyy')} · ${a.time} (${a.durationMinutes} dk)` : 'Atanmadı'} />
          {a.kind === 'PILATES' ? (
            <>
              <KeyValue label="Pilates talebi" value={a.pilatesFormat ? PILATES_FORMAT_LABEL[a.pilatesFormat] : 'Ders türü belirtilmedi'} />
              <KeyValue label="Tercih" value={pilatesPreferenceText(a.preferredDays, a.preferredDayparts)} />
            </>
          ) : (
            <KeyValue label="Görüşme türü" value={`${MEETING_TYPE_LABEL[a.meetingType]}${a.service ? ` · ${a.service.title}` : ''}`} />
          )}
          <KeyValue
            label="KVKK"
            last
            value={`${a.kvkkNoticeAcceptedAt ? `Aydınlatma onayı: ${formatDateTime(a.kvkkNoticeAcceptedAt)}` : 'Aydınlatma kaydı yok'}${a.explicitConsentAt ? `\nAçık rıza: ${formatDateTime(a.explicitConsentAt)}` : ''}`}
          />
        </Card>
        {a.kind === 'PILATES' && a.pilatesFormat === 'GROUP' ? (
          <Button title="Pilates gruplarına git" variant="ghost" size="sm" icon="activity" style={{ alignSelf: 'flex-start', marginTop: space.sm }} onPress={() => router.push('/panel/pilates')} />
        ) : null}
      </Section>

      {a.clientMessage ? (
        <Section title="Danışanın mesajı">
          <Card>
            <T>{a.clientMessage}</T>
          </Card>
        </Section>
      ) : null}

      <Section title="Dahili not">
        {canWrite ? (
          <View style={{ gap: space.sm }}>
            <TextField value={note} onChange={setNote} rows={3} maxLength={2000} help="Yalnızca panel kullanıcıları görür. Sağlık bilgisi için danışan profilindeki şifreli görüşme notlarını kullanın." />
            {note !== (a.internalNote ?? '') ? (
              <Button
                title="Notu kaydet"
                size="sm"
                style={{ alignSelf: 'flex-end' }}
                loading={busy('note')}
                onPress={() => run({ key: 'note', fn: () => api.patch(`/appointments/${a.id}`, { internalNote: note.trim() || null }), msg: 'Not kaydedildi' })}
              />
            ) : null}
          </View>
        ) : (
          <Card>
            <T muted={!a.internalNote}>{a.internalNote || 'Not yok'}</T>
          </Card>
        )}
      </Section>

      <Section title="Durum geçmişi">
        <StatusHistory items={a.statusHistory} />
      </Section>

      {canWrite && a.status !== 'COMPLETED' ? (
        <Button title="Randevuyu sil" icon="trash-2" variant="danger" loading={busy('delete')} onPress={() => void remove()} />
      ) : a.status === 'COMPLETED' ? (
        <Notice tone="neutral" text="Tamamlanmış randevular silinemez; kayıt geçmişi için saklanır." />
      ) : null}

      <ReasonSheet
        mode={sheet === 'reject' || sheet === 'cancel' ? sheet : null}
        onClose={() => setSheet(null)}
        loading={busy('CANCELLED')}
        onSubmit={(reason) => setStatus('CANCELLED', sheet === 'reject' ? 'Talep reddedildi' : 'Randevu iptal edildi', reason)}
      />
      <RescheduleSheet
        a={a}
        visible={sheet === 'reschedule'}
        onClose={() => setSheet(null)}
        loading={busy('reschedule')}
        onSubmit={(v) => run({ key: 'reschedule', fn: () => api.patch(`/appointments/${a.id}`, v), msg: 'Randevu zamanı güncellendi' })}
      />
    </Screen>
  );
}
