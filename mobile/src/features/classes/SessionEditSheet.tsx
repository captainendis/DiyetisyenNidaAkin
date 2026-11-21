// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Ders düzenleme: ad, tarih/saat/süre (yalnızca planlı derslerde), kontenjan, not */
import { useEffect, useState } from 'react';
import { Button, DateField, FieldRow, Form, Notice, Sheet, SwitchField, TextField, TimeField } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { formatDayStr, todayStr } from '@/lib/format';
import { CLASS_CAPACITY_MAX } from '@shared/constants';
import { timeRange, type ClassSessionDTO } from './shared';

export function SessionEditSheet({
  session: s,
  visible,
  onClose,
  onSaved,
}: {
  session: ClassSessionDTO;
  visible: boolean;
  onClose: () => void;
  onSaved: (s: ClassSessionDTO) => void;
}) {
  const [form, setForm] = useState({ title: '', date: '', time: '', duration: '', capacity: '', note: '', outside: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const scheduled = s.status === 'SCHEDULED';

  useEffect(() => {
    if (!visible) return;
    setForm({ title: s.title, date: s.date, time: s.time, duration: String(s.durationMinutes), capacity: String(s.capacity), note: s.note ?? '', outside: false });
    setErrors({});
    setError('');
  }, [visible, s]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    const body: Record<string, unknown> = { title: form.title.trim(), capacity: Number(form.capacity), note: form.note.trim() || null, allowOutsideHours: form.outside };
    if (scheduled && (form.date !== s.date || form.time !== s.time || Number(form.duration) !== s.durationMinutes)) {
      Object.assign(body, { date: form.date, time: form.time, durationMinutes: Number(form.duration) });
    }
    setBusy(true);
    setError('');
    try {
      const r = await api.patch<{ session: ClassSessionDTO }>(`/classes/sessions/${s.id}`, body);
      onSaved(r.session);
    } catch (e) {
      const fields = (e as { fields?: Record<string, string> }).fields ?? {};
      setErrors(fields);
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Dersi düzenle"
      full
      footer={
        <>
          <Button title="Vazgeç" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
          <Button title="Kaydet" onPress={() => void save()} loading={busy} style={{ flex: 1 }} />
        </>
      }
    >
      <Form>
        {error ? <Notice tone="danger" text={error} /> : null}
        <TextField label="Ders adı" value={form.title} onChange={(v) => set('title', v)} error={errors.title} maxLength={80} />
        {scheduled ? (
          <>
            <DateField label="Tarih" value={form.date} onChange={(v) => set('date', v)} minimumDate={todayStr()} error={errors.date} />
            <FieldRow>
              <TimeField label="Saat" value={form.time} onChange={(v) => set('time', v)} error={errors.time} />
              <TextField label="Süre (dk)" value={form.duration} onChange={(v) => set('duration', v.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={3} error={errors.durationMinutes} />
            </FieldRow>
          </>
        ) : (
          <Notice tone="neutral" text={`${formatDayStr(s.date, 'd MMMM yyyy, cccc')} · ${timeRange(s.time, s.durationMinutes)}. Yalnızca planlı derslerin zamanı değiştirilebilir.`} />
        )}
        <TextField
          label="Kontenjan"
          value={form.capacity}
          onChange={(v) => set('capacity', v.replace(/\D/g, ''))}
          keyboardType="number-pad"
          maxLength={2}
          error={errors.capacity}
          help={`1–${CLASS_CAPACITY_MAX} kişi`}
        />
        {scheduled ? (
          <SwitchField label="Çalışma saatleri dışında olabilir" help="Randevu ve diğer derslerle çakışma yine kontrol edilir." value={form.outside} onChange={(v) => set('outside', v)} />
        ) : null}
        <TextField label="Not" value={form.note} onChange={(v) => set('note', v)} rows={3} maxLength={1000} error={errors.note} placeholder="Yalnızca panelde görünür" />
      </Form>
    </Sheet>
  );
}
