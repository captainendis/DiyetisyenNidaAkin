// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Randevu detayı parçaları: neden sayfası (reddet/iptal), yeniden planlama sayfası, durum geçmişi */
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { APPOINTMENT_STATUS_LABEL } from '@shared/constants';
import { todayStr } from '@shared/time';
import { Button, Card, DateField, Sheet, SwitchField, T, TextField } from '@/components/ui';
import { formatDateTime } from '@/lib/format';
import { colors, space } from '@/theme';
import { SlotPicker } from './SlotPicker';
import type { AppointmentDetail, StatusHistoryEntry } from './types';

export function ReasonSheet({
  mode,
  onClose,
  onSubmit,
  loading,
}: {
  mode: 'reject' | 'cancel' | null;
  onClose: () => void;
  onSubmit: (reason: string) => void;
  loading: boolean;
}) {
  const [reason, setReason] = useState('');
  useEffect(() => {
    if (mode) setReason('');
  }, [mode]);
  const reject = mode === 'reject';
  return (
    <Sheet
      visible={!!mode}
      onClose={onClose}
      title={reject ? 'Talebi reddet' : 'Randevuyu iptal et'}
      subtitle="Kişiye otomatik bildirim gönderilmez; gerekirse telefonla bilgilendirin."
      footer={
        <>
          <Button title="Vazgeç" variant="secondary" style={{ flex: 1 }} onPress={onClose} />
          <Button title={reject ? 'Talebi reddet' : 'Randevuyu iptal et'} variant="danger" style={{ flex: 1 }} loading={loading} onPress={() => onSubmit(reason)} />
        </>
      }
    >
      <TextField
        label={reject ? 'Reddetme nedeni (isteğe bağlı, yalnızca panelde görünür)' : 'İptal nedeni (isteğe bağlı)'}
        value={reason}
        onChange={setReason}
        rows={3}
        maxLength={500}
      />
    </Sheet>
  );
}

export function RescheduleSheet({
  a,
  visible,
  onClose,
  onSubmit,
  loading,
}: {
  a: AppointmentDetail;
  visible: boolean;
  onClose: () => void;
  onSubmit: (v: { date: string; time: string; allowOutsideHours: boolean }) => void;
  loading: boolean;
}) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [free, setFree] = useState(false);
  useEffect(() => {
    if (visible) {
      setDate(a.date && a.date >= todayStr() ? a.date : todayStr());
      setTime('');
      setFree(false);
    }
  }, [visible, a.date]);
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      full
      title={a.date ? 'Tarihi / saati değiştir' : 'Tarih ve saat ata'}
      subtitle="Çakışma ve çalışma saati kontrolü kayıt sırasında yapılır."
      footer={
        <>
          <Button title="Vazgeç" variant="secondary" style={{ flex: 1 }} onPress={onClose} />
          <Button title="Yeni zamanı kaydet" style={{ flex: 1 }} disabled={!date || !time} loading={loading} onPress={() => onSubmit({ date, time, allowOutsideHours: free })} />
        </>
      }
    >
      <DateField
        label="Tarih"
        value={date}
        minimumDate={todayStr()}
        onChange={(d) => {
          setDate(d);
          setTime('');
        }}
      />
      <SwitchField
        label="Çalışma saatleri dışında"
        value={free}
        onChange={(v) => {
          setFree(v);
          setTime('');
        }}
      />
      <SlotPicker date={date} duration={a.durationMinutes ?? undefined} ignoreId={a.id} value={time} onChange={setTime} freeTime={free} />
    </Sheet>
  );
}

function historyText(h: StatusHistoryEntry) {
  if (h.newStartsAt) return `Zaman değişti: ${h.previousStartsAt ? formatDateTime(h.previousStartsAt) : '—'} → ${formatDateTime(h.newStartsAt)}`;
  if (h.fromStatus) return `${APPOINTMENT_STATUS_LABEL[h.fromStatus]} → ${APPOINTMENT_STATUS_LABEL[h.toStatus]}`;
  return `Oluşturuldu: ${APPOINTMENT_STATUS_LABEL[h.toStatus]}`;
}

export function StatusHistory({ items }: { items: StatusHistoryEntry[] }) {
  return (
    <Card>
      {items.map((h, i) => (
        <View key={h.id} style={styles.hRow}>
          <View style={styles.rail}>
            <View style={styles.dot} />
            {i < items.length - 1 ? <View style={styles.railLine} /> : null}
          </View>
          <View style={{ flex: 1, gap: 2, paddingBottom: i < items.length - 1 ? space.md : 0 }}>
            <T variant="label">{historyText(h)}</T>
            <T variant="caption">
              {formatDateTime(h.changedAt)}
              {h.changedBy ? ` · ${h.changedBy.firstName} ${h.changedBy.lastName}` : ''}
              {h.note ? ` · ${h.note}` : ''}
            </T>
          </View>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  hRow: { flexDirection: 'row', gap: space.md },
  rail: { width: 10, alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.cocoa, marginTop: 5 },
  railLine: { flex: 1, width: StyleSheet.hairlineWidth * 2, backgroundColor: colors.line, marginTop: 4 },
});
