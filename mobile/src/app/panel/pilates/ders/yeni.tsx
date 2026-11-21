// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Tek ders ekle: bir gruptan (üyeler otomatik) veya grupsuz (deneme dersi, özel ders). Web: NewSessionModal */
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Button, DateField, Empty, FieldRow, Form, Notice, QueryView, Screen, SelectField, SwitchField, T, TextField, TimeField, useToast } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { todayStr } from '@/lib/format';
import { useStaff } from '@/lib/auth';
import { queryClient } from '@/lib/query';
import { CLASS_CAPACITY_DEFAULT, CLASS_CAPACITY_MAX } from '@shared/constants';
import { ClientPicker } from '@/features/classes/ClientPicker';
import { useGroups } from '@/features/classes/GroupList';
import { clientName, type ClassClientRef, type ClassGroupDTO, type ClassSessionDTO } from '@/features/classes/shared';

export default function NewSessionScreen() {
  const { can } = useStaff();
  const groups = useGroups();
  if (!can('appointments:write')) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Tek ders ekle' }} />
        <Empty icon="lock" title="Yetkiniz yok" text="Ders eklemek için yazma yetkisi gerekir." />
      </Screen>
    );
  }
  return (
    <>
      <Stack.Screen options={{ title: 'Tek ders ekle' }} />
      <QueryView query={groups}>{({ items }) => <NewSessionForm groups={items} />}</QueryView>
    </>
  );
}

function NewSessionForm({ groups }: { groups: ClassGroupDTO[] }) {
  const params = useLocalSearchParams<{ groupId?: string; date?: string; time?: string }>();
  const toast = useToast();
  const active = groups.filter((g) => g.isActive);
  const [groupId, setGroupId] = useState('');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(params.date ?? todayStr());
  const [time, setTime] = useState(params.time ?? '');
  const [duration, setDuration] = useState('50');
  const [capacity, setCapacity] = useState(String(CLASS_CAPACITY_DEFAULT));
  const [extra, setExtra] = useState<ClassClientRef[]>([]);
  const [note, setNote] = useState('');
  const [outside, setOutside] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  const pickGroup = (id: string) => {
    setGroupId(id);
    const g = groups.find((x) => x.id === id);
    if (g) {
      setDuration(String(g.defaultDurationMinutes));
      setCapacity(String(g.capacity));
    }
    setExtra([]);
  };

  // Gruptan açıldıysa grubu ön seç
  const init = useRef(false);
  useEffect(() => {
    if (init.current) return;
    init.current = true;
    if (params.groupId && active.some((g) => g.id === params.groupId)) pickGroup(params.groupId);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const group = groups.find((g) => g.id === groupId) ?? null;
  const cap = Math.max(1, Math.min(CLASS_CAPACITY_MAX, Number(capacity) || 1));
  const memberCount = group?.members.length ?? 0;

  const submit = async () => {
    const errs: Record<string, string> = {};
    if (!group && title.trim().length < 2) errs.title = 'Ders adı girin veya grup seçin';
    if (!time) errs.time = 'Saat girin';
    if (memberCount + extra.length > cap) errs.clientIds = 'Kontenjan aşılıyor';
    setErrors(errs);
    setError('');
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
      toast(`Ders eklendi · ${r.session.title} ${r.session.time}`);
      await queryClient.invalidateQueries({ queryKey: ['classes'] });
      router.replace(`/panel/pilates/ders/${r.session.id}`);
    } catch (e) {
      setErrors((e as { fields?: Record<string, string> }).fields ?? {});
      setError(errorMessage(e));
    } finally {
      setPending(false);
    }
  };

  return (
    <Screen footer={<Button title="Dersi ekle" icon="plus" full onPress={() => void submit()} loading={pending} />}>
      <Form>
        <T variant="caption">Telafi, deneme veya özel ders için. Düzenli dersler için “Ders programı ekle” seçeneğini kullanın.</T>
        {error ? <Notice tone="danger" title="Ders eklenemedi" text={error} /> : null}
        <SelectField
          label="Grup"
          value={groupId}
          onChange={pickGroup}
          options={[{ value: '', label: 'Grupsuz ders' }, ...active.map((g) => ({ value: g.id, label: `${g.name} (${g.members.length}/${g.capacity})` }))]}
          placeholder="Grupsuz ders"
        />
        <TextField label="Ders adı" value={title} onChange={setTitle} error={errors.title} maxLength={80} placeholder={group ? group.name : 'ör. Deneme dersi'} required={!group} />
        <DateField label="Tarih" value={date} onChange={setDate} minimumDate={todayStr()} error={errors.date} required />
        <FieldRow>
          <TimeField label="Saat" value={time} onChange={setTime} error={errors.time} required />
          <TextField label="Süre (dk)" value={duration} onChange={(v) => setDuration(v.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={3} error={errors.durationMinutes} />
        </FieldRow>
        <TextField
          label="Kontenjan"
          value={capacity}
          onChange={(v) => setCapacity(v.replace(/\D/g, ''))}
          keyboardType="number-pad"
          maxLength={2}
          error={errors.capacity}
          help={`1–${CLASS_CAPACITY_MAX} kişi`}
        />
        {group ? (
          <Notice
            tone="neutral"
            icon="users"
            text={`Grup üyeleri otomatik eklenir: ${group.members.map(clientName).join(', ') || 'henüz üye yok'}`}
          />
        ) : null}
        <ClientPicker
          label={group ? 'Ek katılımcılar' : 'Katılımcılar'}
          value={extra}
          onChange={setExtra}
          max={Math.max(0, cap - memberCount)}
          exclude={group?.members.map((m) => m.id) ?? []}
          error={errors.clientIds}
        />
        <SwitchField label="Çalışma saatleri dışında olabilir" help="Randevu ve diğer derslerle çakışma yine kontrol edilir." value={outside} onChange={setOutside} />
        <TextField label="Not" value={note} onChange={setNote} rows={3} maxLength={1000} placeholder="Yalnızca panelde görünür" error={errors.note} />
      </Form>
    </Screen>
  );
}
