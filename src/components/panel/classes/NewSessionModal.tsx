// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Tek ders ekle: bir gruptan (üyeler otomatik) veya grupsuz (deneme dersi, özel ders) */
import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { todayStr } from '@/lib/format';
import { CLASS_CAPACITY_DEFAULT, CLASS_CAPACITY_MAX } from '@shared/constants';
import { Button, Input, Modal, Select, Switch, Textarea, useFeedback } from '@/components/panel/ui';
import { MultiClientPicker, type ClassClientRef, type ClassGroupDTO, type ClassSessionDTO } from './shared';

export function NewSessionModal({
  open, groups, initial, onClose, onCreated,
}: {
  open: boolean;
  groups: ClassGroupDTO[];
  initial?: { groupId?: string; date?: string; time?: string };
  onClose: () => void;
  onCreated: (s: ClassSessionDTO) => void;
}) {
  const fb = useFeedback();
  const active = groups.filter((g) => g.isActive);
  const [groupId, setGroupId] = useState('');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(todayStr());
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState('50');
  const [capacity, setCapacity] = useState(String(CLASS_CAPACITY_DEFAULT));
  const [extra, setExtra] = useState<ClassClientRef[]>([]);
  const [note, setNote] = useState('');
  const [outside, setOutside] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    const g = groups.find((x) => x.id === initial?.groupId);
    setGroupId(g?.id ?? '');
    setTitle('');
    setDate(initial?.date ?? todayStr());
    setTime(initial?.time ?? '');
    setDuration(String(g?.defaultDurationMinutes ?? 50));
    setCapacity(String(g?.capacity ?? CLASS_CAPACITY_DEFAULT));
    setExtra([]);
    setNote('');
    setOutside(false);
    setErrors({});
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const group = groups.find((g) => g.id === groupId) ?? null;
  const cap = Math.max(1, Math.min(CLASS_CAPACITY_MAX, Number(capacity) || 1));
  const memberCount = group?.members.length ?? 0;

  const pickGroup = (id: string) => {
    setGroupId(id);
    const g = groups.find((x) => x.id === id);
    if (g) {
      setDuration(String(g.defaultDurationMinutes));
      setCapacity(String(g.capacity));
    }
    setExtra([]);
  };

  const submit = async () => {
    const errs: Record<string, string> = {};
    if (!group && title.trim().length < 2) errs.title = 'Ders adı girin veya grup seçin';
    if (!time) errs.time = 'Saat girin';
    if (memberCount + extra.length > cap) errs.clientIds = 'Kontenjan aşılıyor';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setPending(true);
    try {
      const r = await api.post<{ session: ClassSessionDTO }>('/classes/sessions', {
        groupId: group?.id ?? null,
        title: title.trim() || null,
        date,
        time,
        durationMinutes: Number(duration) || undefined,
        capacity: cap,
        clientIds: extra.map((c) => c.id),
        note: note.trim() || null,
        allowOutsideHours: outside,
      });
      fb.success('Ders eklendi', `${r.session.title} · ${r.session.time}`);
      onCreated(r.session);
      onClose();
    } catch (e) {
      if (e instanceof ApiError) {
        if (Object.keys(e.fields).length) setErrors(e.fields);
        fb.error('Ders eklenemedi', e.message);
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Tek ders ekle"
      description="Telafi, deneme veya özel ders için. Düzenli dersler için grubun “Ders programı ekle” seçeneğini kullanın."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Vazgeç</Button>
          <Button onClick={submit} loading={pending}>Dersi ekle</Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            label="Grup"
            value={groupId}
            onChange={(e) => pickGroup(e.target.value)}
            placeholder="Grupsuz ders"
            options={active.map((g) => ({ value: g.id, label: `${g.name} (${g.members.length}/${g.capacity})` }))}
          />
          <Input label="Ders adı" value={title} onChange={(e) => setTitle(e.target.value)} error={errors.title} maxLength={80} placeholder={group ? group.name : 'ör. Deneme dersi'} />
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <Input label="Tarih" type="date" min={todayStr()} value={date} onChange={(e) => setDate(e.target.value)} error={errors.date} className="tabular" />
          <Input label="Saat" type="time" step={300} value={time} onChange={(e) => setTime(e.target.value)} error={errors.time} className="tabular" />
          <Input label="Süre (dk)" type="number" min={15} max={240} step={5} value={duration} onChange={(e) => setDuration(e.target.value)} className="tabular" />
          <Input label="Kontenjan" type="number" min={1} max={CLASS_CAPACITY_MAX} value={capacity} onChange={(e) => setCapacity(e.target.value)} error={errors.capacity} className="tabular" />
        </div>
        {group && (
          <p className="rounded-lg bg-panel-bg px-3.5 py-2.5 text-[0.85rem] text-cocoa">
            Grup üyeleri otomatik eklenir: <strong>{group.members.map((m) => `${m.firstName} ${m.lastName}`).join(', ') || 'henüz üye yok'}</strong>
          </p>
        )}
        <MultiClientPicker
          label={group ? 'Ek katılımcılar' : 'Katılımcılar'}
          value={extra}
          onChange={setExtra}
          max={Math.max(0, cap - memberCount)}
          exclude={group?.members.map((m) => m.id) ?? []}
          error={errors.clientIds}
        />
        <Switch checked={outside} onChange={setOutside} label="Çalışma saatleri dışında olabilir" description="Randevu ve diğer derslerle çakışma yine kontrol edilir." />
        <Textarea label="Not" rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="Yalnızca panelde görünür" />
      </div>
    </Modal>
  );
}
