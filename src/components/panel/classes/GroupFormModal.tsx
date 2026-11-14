// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Pilates grubu oluştur / düzenle: ad, kontenjan, ders süresi, not ve üyeler */
import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { CLASS_CAPACITY_DEFAULT, CLASS_CAPACITY_MAX } from '@shared/constants';
import { Button, Input, Modal, Switch, Textarea, useFeedback } from '@/components/panel/ui';
import { MultiClientPicker, type ClassClientRef, type ClassGroupDTO, type ClassMemberSyncResult } from './shared';

export function GroupFormModal({
  open, group, onClose, onSaved,
}: {
  open: boolean;
  /** Düzenlenecek grup; boşsa yeni grup */
  group: ClassGroupDTO | null;
  onClose: () => void;
  onSaved: (g: ClassGroupDTO, isNew: boolean) => void;
}) {
  const fb = useFeedback();
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState(String(CLASS_CAPACITY_DEFAULT));
  const [duration, setDuration] = useState('50');
  const [note, setNote] = useState('');
  const [members, setMembers] = useState<ClassClientRef[]>([]);
  const [sync, setSync] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(group?.name ?? '');
    setCapacity(String(group?.capacity ?? CLASS_CAPACITY_DEFAULT));
    setDuration(String(group?.defaultDurationMinutes ?? 50));
    setNote(group?.note ?? '');
    setMembers(group?.members ?? []);
    setSync(true);
    setErrors({});
  }, [open, group]);

  const cap = Math.max(1, Math.min(CLASS_CAPACITY_MAX, Number(capacity) || 1));
  const membersChanged = !!group && (group.members.length !== members.length || group.members.some((m) => !members.find((x) => x.id === m.id)));

  const submit = async () => {
    const errs: Record<string, string> = {};
    if (name.trim().length < 2) errs.name = 'Grup adı girin';
    if (members.length > cap) errs.memberIds = `En fazla ${cap} kişi`;
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setPending(true);
    try {
      const fields = { name: name.trim(), capacity: cap, defaultDurationMinutes: Number(duration) || 50, note: note.trim() || null };
      if (!group) {
        const r = await api.post<{ group: ClassGroupDTO }>('/classes/groups', { ...fields, memberIds: members.map((m) => m.id) });
        fb.success('Grup oluşturuldu', r.group.name);
        onSaved(r.group, true);
        return;
      }
      // Kontenjan düşürülüyorsa önce üyeler (kontenjan üye sayısından az olamaz), artırılıyorsa önce kontenjan güncellenmeli
      const saveMembers = () =>
        membersChanged
          ? api.put<{ group: ClassGroupDTO; sync: ClassMemberSyncResult }>(`/classes/groups/${group.id}/members`, { memberIds: members.map((m) => m.id), syncUpcoming: sync })
          : Promise.resolve(null);
      const patch = () => api.patch<{ group: ClassGroupDTO }>(`/classes/groups/${group.id}`, fields);
      let s: ClassMemberSyncResult | undefined;
      let saved: ClassGroupDTO;
      if (cap < group.capacity) {
        s = (await saveMembers())?.sync;
        saved = (await patch()).group;
      } else {
        saved = (await patch()).group;
        const m = await saveMembers();
        if (m) {
          s = m.sync;
          saved = m.group;
        }
      }
      const res = { group: saved };
      fb.success(
        'Grup güncellendi',
        s && (s.added || s.removed || s.full)
          ? [s.added && `${s.added} derse eklendi`, s.removed && `${s.removed} dersten çıkarıldı`, s.full && `${s.full} ders dolu olduğu için eklenemedi`].filter(Boolean).join(' · ')
          : undefined,
      );
      onSaved(res.group, false);
    } catch (e) {
      if (e instanceof ApiError) {
        if (Object.keys(e.fields).length) setErrors(e.fields);
        fb.error('Grup kaydedilemedi', e.message);
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={group ? 'Grubu düzenle' : 'Yeni pilates grubu'}
      description="Sabit grup üyeleri, gruptan açılan her derse otomatik eklenir."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Vazgeç</Button>
          <Button onClick={submit} loading={pending}>{group ? 'Kaydet' : 'Grubu oluştur'}</Button>
        </>
      }
    >
      <div className="space-y-5">
        <Input label="Grup adı" required value={name} onChange={(e) => setName(e.target.value)} error={errors.name} maxLength={80} placeholder="ör. Salı–Perşembe 18:00" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Kontenjan (kişi)"
            type="number"
            min={1}
            max={CLASS_CAPACITY_MAX}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            error={errors.capacity}
            hint="Reformer pilates için genelde 3"
            className="tabular"
          />
          <Input label="Ders süresi (dk)" type="number" min={15} max={240} step={5} value={duration} onChange={(e) => setDuration(e.target.value)} error={errors.defaultDurationMinutes} className="tabular" />
        </div>
        <MultiClientPicker value={members} onChange={setMembers} max={cap} error={errors.memberIds} hint="Telafi / misafir katılımcıları tek tek derslere ekleyebilirsiniz." />
        {group && membersChanged && group.upcomingCount > 0 && (
          <Switch
            checked={sync}
            onChange={setSync}
            label="Planlı dersleri de güncelle"
            description={`Gruptan çıkan kişi ${group.upcomingCount} planlı dersten çıkarılır, yeni üye yer olan derslere eklenir.`}
          />
        )}
        <Textarea label="Not" rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="Yalnızca panelde görünür (ör. seviye, salon)" />
      </div>
    </Modal>
  );
}
