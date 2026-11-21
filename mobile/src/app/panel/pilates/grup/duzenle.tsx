// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Pilates grubu oluştur / düzenle (?id=…): ad, kontenjan, ders süresi, not ve üyeler. Web: GroupFormModal */
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Button, Empty, FieldRow, Form, Notice, QueryView, Screen, SwitchField, T, TextField, useToast } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useStaff } from '@/lib/auth';
import { queryClient } from '@/lib/query';
import { CLASS_CAPACITY_DEFAULT, CLASS_CAPACITY_MAX } from '@shared/constants';
import { ClientPicker } from '@/features/classes/ClientPicker';
import { useGroups } from '@/features/classes/GroupList';
import type { ClassClientRef, ClassGroupDTO, ClassMemberSyncResult } from '@/features/classes/shared';

export default function GroupFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { can } = useStaff();
  const groups = useGroups();
  const title = id ? 'Grubu düzenle' : 'Yeni pilates grubu';
  if (!can('appointments:write')) {
    return (
      <Screen>
        <Stack.Screen options={{ title }} />
        <Empty icon="lock" title="Yetkiniz yok" text="Grupları düzenlemek için yazma yetkisi gerekir." />
      </Screen>
    );
  }
  return (
    <>
      <Stack.Screen options={{ title }} />
      {id ? (
        <QueryView query={groups}>
          {({ items }) => {
            const g = items.find((x) => x.id === id);
            return g ? <GroupForm group={g} /> : <Empty icon="alert-circle" title="Grup bulunamadı" />;
          }}
        </QueryView>
      ) : (
        <GroupForm group={null} />
      )}
    </>
  );
}

function GroupForm({ group }: { group: ClassGroupDTO | null }) {
  const toast = useToast();
  const [name, setName] = useState(group?.name ?? '');
  const [capacity, setCapacity] = useState(String(group?.capacity ?? CLASS_CAPACITY_DEFAULT));
  const [duration, setDuration] = useState(String(group?.defaultDurationMinutes ?? 50));
  const [note, setNote] = useState(group?.note ?? '');
  const [members, setMembers] = useState<ClassClientRef[]>(group?.members ?? []);
  const [sync, setSync] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  const cap = Math.max(1, Math.min(CLASS_CAPACITY_MAX, Number(capacity) || 1));
  const membersChanged = !!group && (group.members.length !== members.length || group.members.some((m) => !members.find((x) => x.id === m.id)));

  const submit = async () => {
    const errs: Record<string, string> = {};
    if (name.trim().length < 2) errs.name = 'Grup adı girin';
    if (members.length > cap) errs.memberIds = `En fazla ${cap} kişi`;
    setErrors(errs);
    setError('');
    if (Object.keys(errs).length) return;
    setPending(true);
    try {
      const fields = { name: name.trim(), capacity: cap, defaultDurationMinutes: Number(duration) || 50, note: note.trim() || null };
      if (!group) {
        const r = await api.post<{ group: ClassGroupDTO }>('/classes/groups', { ...fields, memberIds: members.map((m) => m.id) });
        toast(`Grup oluşturuldu · ${r.group.name}`);
        await queryClient.invalidateQueries({ queryKey: ['classes'] });
        router.replace(`/panel/pilates/grup/${r.group.id}`);
        return;
      }
      // Kontenjan düşürülüyorsa önce üyeler (kontenjan üye sayısından az olamaz), artırılıyorsa önce kontenjan güncellenmeli
      const saveMembers = () =>
        membersChanged
          ? api.put<{ group: ClassGroupDTO; sync: ClassMemberSyncResult }>(`/classes/groups/${group.id}/members`, { memberIds: members.map((m) => m.id), syncUpcoming: sync })
          : Promise.resolve(null);
      const patch = () => api.patch<{ group: ClassGroupDTO }>(`/classes/groups/${group.id}`, fields);
      let s: ClassMemberSyncResult | undefined;
      if (cap < group.capacity) {
        s = (await saveMembers())?.sync;
        await patch();
      } else {
        await patch();
        s = (await saveMembers())?.sync;
      }
      const detail =
        s && (s.added || s.removed || s.full)
          ? [s.added && `${s.added} derse eklendi`, s.removed && `${s.removed} dersten çıkarıldı`, s.full && `${s.full} ders dolu olduğu için eklenemedi`].filter(Boolean).join(' · ')
          : '';
      toast(detail ? `Grup güncellendi · ${detail}` : 'Grup güncellendi');
      await queryClient.invalidateQueries({ queryKey: ['classes'] });
      router.back();
    } catch (e) {
      setErrors((e as { fields?: Record<string, string> }).fields ?? {});
      setError(errorMessage(e));
    } finally {
      setPending(false);
    }
  };

  return (
    <Screen footer={<Button title={group ? 'Kaydet' : 'Grubu oluştur'} full onPress={() => void submit()} loading={pending} />}>
      <Form>
        <T variant="caption">Sabit grup üyeleri, gruptan açılan her derse otomatik eklenir.</T>
        {error ? <Notice tone="danger" title="Grup kaydedilemedi" text={error} /> : null}
        <TextField label="Grup adı" required value={name} onChange={setName} error={errors.name} maxLength={80} placeholder="ör. Salı–Perşembe 18:00" />
        <FieldRow>
          <TextField
            label="Kontenjan (kişi)"
            value={capacity}
            onChange={(v) => setCapacity(v.replace(/\D/g, ''))}
            keyboardType="number-pad"
            maxLength={2}
            error={errors.capacity}
            help="Reformer için genelde 3"
          />
          <TextField
            label="Ders süresi (dk)"
            value={duration}
            onChange={(v) => setDuration(v.replace(/\D/g, ''))}
            keyboardType="number-pad"
            maxLength={3}
            error={errors.defaultDurationMinutes}
          />
        </FieldRow>
        <ClientPicker value={members} onChange={setMembers} max={cap} error={errors.memberIds} hint="Telafi / misafir katılımcıları tek tek derslere ekleyebilirsiniz." />
        {group && membersChanged && group.upcomingCount > 0 ? (
          <SwitchField
            label="Planlı dersleri de güncelle"
            help={`Gruptan çıkan kişi ${group.upcomingCount} planlı dersten çıkarılır, yeni üye yer olan derslere eklenir.`}
            value={sync}
            onChange={setSync}
          />
        ) : null}
        <TextField label="Not" value={note} onChange={setNote} rows={3} maxLength={1000} error={errors.note} placeholder="Yalnızca panelde görünür (ör. seviye, salon)" />
      </Form>
    </Screen>
  );
}
