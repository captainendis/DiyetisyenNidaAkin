// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Yeni danışan / danışan düzenleme formu (web: ClientFormModal) */
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Button, DateField, Form, Notice, SelectField, Sheet, SwitchField, T, TextField, useToast } from '@/components/ui';
import { api, ApiError, errorMessage } from '@/lib/api';
import { queryClient } from '@/lib/query';
import { CLIENT_SEX_LABEL, CLIENT_SEXES, CLIENT_STATUS_LABEL, CLIENT_STATUSES, MEETING_TYPE_LABEL, MEETING_TYPES, type ClientSex, type ClientStatus, type MeetingType } from '@shared/constants';
import { todayStr } from '@shared/time';
import { space } from '@/theme';
import { clientKeys, type Client, type ClientDetail } from './types';

interface FormState {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  birthDate: string;
  sex: '' | ClientSex;
  firstVisitDate: string;
  preferredMeetingType: '' | MeetingType;
  internalNote: string;
  kvkkNoticeGiven: boolean;
  status: ClientStatus;
}

const empty: FormState = {
  firstName: '', lastName: '', phone: '', email: '', birthDate: '', sex: '', firstVisitDate: '', preferredMeetingType: '', internalNote: '', kvkkNoticeGiven: false, status: 'ACTIVE',
};

function fromClient(c: Client): FormState {
  return {
    firstName: c.firstName,
    lastName: c.lastName,
    phone: c.phone.replace(/^\+90(5\d{2})(\d{3})(\d{2})(\d{2})$/, '0$1 $2 $3 $4'),
    email: c.email ?? '',
    birthDate: c.birthDate ?? '',
    sex: c.sex ?? '',
    firstVisitDate: c.firstVisitDate ?? '',
    preferredMeetingType: c.preferredMeetingType ?? '',
    internalNote: c.internalNote ?? '',
    kvkkNoticeGiven: !!c.kvkkNoticeAt,
    status: c.status,
  };
}

/** Form durumu + alanlar + kaydet; hem Sheet'te hem ayrı ekranda kullanılır */
export function useClientForm({ client, active, onSaved, onLeave }: { client?: Client | null; active: boolean; onSaved: (c: Client) => void; onLeave?: () => void }) {
  const [f, setF] = useState<FormState>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [duplicateId, setDuplicateId] = useState<string | null>(null);
  const [general, setGeneral] = useState<string | null>(null);
  const toast = useToast();
  const editing = !!client;

  useEffect(() => {
    if (active) {
      setF(client ? fromClient(client) : empty);
      setErrors({});
      setDuplicateId(null);
      setGeneral(null);
    }
  }, [active, client]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }));

  async function submit() {
    setPending(true);
    setErrors({});
    setDuplicateId(null);
    setGeneral(null);
    const body = {
      firstName: f.firstName,
      lastName: f.lastName,
      phone: f.phone,
      email: f.email.trim() || null,
      birthDate: f.birthDate || null,
      sex: f.sex || null,
      firstVisitDate: f.firstVisitDate || null,
      preferredMeetingType: f.preferredMeetingType || null,
      internalNote: f.internalNote || null,
      ...(editing ? { status: f.status } : { kvkkNoticeGiven: f.kvkkNoticeGiven }),
    };
    try {
      const res = editing
        ? await api.patch<{ client: Client }>(`/clients/${client!.id}`, body)
        : await api.post<{ client: Client }>('/clients', body);
      if (editing) queryClient.setQueryData<ClientDetail>(clientKeys.detail(res.client.id), (d) => (d ? { ...d, client: res.client } : d));
      void queryClient.invalidateQueries({ queryKey: ['clients', 'list'] });
      toast(editing ? 'Danışan bilgileri güncellendi' : 'Danışan kaydı oluşturuldu');
      onSaved(res.client);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields);
        const d = err.details as { existingClientId?: string } | undefined;
        if (d?.existingClientId) setDuplicateId(d.existingClientId);
        if (!Object.keys(err.fields).length) setGeneral(err.message);
      } else setGeneral(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  const fields = (
    <Form>
      {!editing ? <Notice tone="info" text="Yalnızca danışmanlık için gerekli bilgileri girin. Sağlık bilgilerini bu forma yazmayın." /> : null}
      <TextField label="Ad" required value={f.firstName} onChange={(v) => set('firstName', v)} error={errors.firstName} autoComplete="off" autoCapitalize="words" />
      <TextField label="Soyad" required value={f.lastName} onChange={(v) => set('lastName', v)} error={errors.lastName} autoComplete="off" autoCapitalize="words" />
      <TextField label="Telefon" required keyboardType="phone-pad" placeholder="05xx xxx xx xx" value={f.phone} onChange={(v) => set('phone', v)} error={errors.phone} />
      {duplicateId ? (
        <View style={{ gap: space.sm }}>
          <T variant="caption">Bu numara zaten kayıtlı.</T>
          <Button
            title="Mevcut danışanı aç"
            size="sm"
            variant="secondary"
            onPress={() => {
              onLeave?.();
              router.push(`/panel/danisanlar/${duplicateId}`);
            }}
          />
        </View>
      ) : null}
      <TextField label="E-posta" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} placeholder="ornek@eposta.com" value={f.email} onChange={(v) => set('email', v)} error={errors.email} />
      <DateField label="Doğum tarihi" help="İsteğe bağlı" maximumDate={todayStr()} value={f.birthDate} onChange={(v) => set('birthDate', v)} error={errors.birthDate} clearable />
      <SelectField<'' | ClientSex>
        label="Cinsiyet"
        help="Yağ oranı tahmini için"
        value={f.sex}
        onChange={(v) => set('sex', v)}
        options={[{ value: '', label: 'Belirtilmedi' }, ...CLIENT_SEXES.map((s) => ({ value: s, label: CLIENT_SEX_LABEL[s] }))]}
      />
      <DateField label="İlk görüşme tarihi" value={f.firstVisitDate} onChange={(v) => set('firstVisitDate', v)} error={errors.firstVisitDate} clearable />
      <SelectField<'' | MeetingType>
        label="Görüşme türü tercihi"
        value={f.preferredMeetingType}
        onChange={(v) => set('preferredMeetingType', v)}
        options={[{ value: '', label: 'Belirtilmedi' }, ...MEETING_TYPES.map((m) => ({ value: m, label: MEETING_TYPE_LABEL[m] }))]}
      />
      {editing ? (
        <SelectField<ClientStatus>
          label="Durum"
          value={f.status}
          onChange={(v) => set('status', v)}
          options={CLIENT_STATUSES.map((s) => ({ value: s, label: CLIENT_STATUS_LABEL[s] }))}
        />
      ) : null}
      <TextField
        label="Dahili not"
        help="Yönetimsel notlar için (ör. ulaşılabilir saatler). Klinik notları Görüşme Notları sekmesinde tutun; orada şifreli saklanır."
        rows={3}
        value={f.internalNote}
        onChange={(v) => set('internalNote', v)}
        error={errors.internalNote}
      />
      {!editing ? (
        <SwitchField
          label="KVKK aydınlatma metni danışana sunuldu"
          help="İşaretlerseniz sunulma tarihi bugünün tarihi olarak kaydedilir."
          value={f.kvkkNoticeGiven}
          onChange={(v) => set('kvkkNoticeGiven', v)}
        />
      ) : null}
      {general ? <Notice tone="danger" text={general} /> : null}
    </Form>
  );

  return { fields, submit, pending, editing };
}

/** Düzenleme / oluşturma sayfası (alttan açılır) */
export function ClientFormSheet({ visible, onClose, client, onSaved }: { visible: boolean; onClose: () => void; client?: Client | null; onSaved: (c: Client) => void }) {
  const form = useClientForm({ client, active: visible, onSaved, onLeave: onClose });
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      full
      title={form.editing ? 'Danışan bilgilerini düzenle' : 'Yeni danışan'}
      footer={
        <>
          <Button title="Vazgeç" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
          <Button title={form.editing ? 'Kaydet' : 'Danışanı ekle'} loading={form.pending} onPress={() => void form.submit()} style={{ flex: 1 }} />
        </>
      }
    >
      {form.fields}
    </Sheet>
  );
}
