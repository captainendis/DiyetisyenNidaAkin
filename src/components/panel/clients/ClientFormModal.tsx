/** Yeni danışan / danışan düzenleme formu */
import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { api, ApiError } from '@/lib/api';
import { Button, Checkbox, Input, Modal, Select, Textarea, useFeedback } from '@/components/panel/ui';
import { CLIENT_STATUS_LABEL, CLIENT_STATUSES, MEETING_TYPE_LABEL } from '@shared/constants';
import { todayStr } from '@shared/time';
import type { Client } from './types';

interface FormState {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  birthDate: string;
  firstVisitDate: string;
  preferredMeetingType: '' | 'IN_PERSON' | 'ONLINE';
  internalNote: string;
  kvkkNoticeGiven: boolean;
  status: Client['status'];
}

const empty: FormState = {
  firstName: '', lastName: '', phone: '', email: '', birthDate: '', firstVisitDate: '', preferredMeetingType: '', internalNote: '', kvkkNoticeGiven: false, status: 'ACTIVE',
};

function fromClient(c: Client): FormState {
  return {
    firstName: c.firstName,
    lastName: c.lastName,
    phone: c.phone.replace(/^\+90(5\d{2})(\d{3})(\d{2})(\d{2})$/, '0$1 $2 $3 $4'),
    email: c.email ?? '',
    birthDate: c.birthDate ?? '',
    firstVisitDate: c.firstVisitDate ?? '',
    preferredMeetingType: c.preferredMeetingType ?? '',
    internalNote: c.internalNote ?? '',
    kvkkNoticeGiven: !!c.kvkkNoticeAt,
    status: c.status,
  };
}

export function ClientFormModal({ open, onClose, client, onSaved }: { open: boolean; onClose: () => void; client?: Client | null; onSaved: (c: Client) => void }) {
  const [f, setF] = useState<FormState>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [duplicateId, setDuplicateId] = useState<string | null>(null);
  const { success, error } = useFeedback();
  const editing = !!client;

  useEffect(() => {
    if (open) {
      setF(client ? fromClient(client) : empty);
      setErrors({});
      setDuplicateId(null);
    }
  }, [open, client]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setErrors({});
    setDuplicateId(null);
    const body = {
      firstName: f.firstName,
      lastName: f.lastName,
      phone: f.phone,
      email: f.email || null,
      birthDate: f.birthDate || null,
      firstVisitDate: f.firstVisitDate || null,
      preferredMeetingType: f.preferredMeetingType || null,
      internalNote: f.internalNote || null,
      ...(editing ? { status: f.status } : { kvkkNoticeGiven: f.kvkkNoticeGiven }),
    };
    try {
      const res = editing
        ? await api.patch<{ client: Client }>(`/clients/${client!.id}`, body)
        : await api.post<{ client: Client }>('/clients', body);
      success(editing ? 'Danışan bilgileri güncellendi' : 'Danışan kaydı oluşturuldu');
      onSaved(res.client);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields);
        const d = err.details as { existingClientId?: string } | undefined;
        if (d?.existingClientId) setDuplicateId(d.existingClientId);
        if (!Object.keys(err.fields).length) error('Kaydedilemedi', err.message);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Danışan bilgilerini düzenle' : 'Yeni danışan'}
      description={editing ? undefined : 'Yalnızca danışmanlık için gerekli bilgileri girin. Sağlık bilgilerini bu forma yazmayın.'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Vazgeç</Button>
          <Button type="submit" form="client-form" loading={pending}>{editing ? 'Kaydet' : 'Danışanı ekle'}</Button>
        </>
      }
    >
      <form id="client-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Input label="Ad" required value={f.firstName} onChange={(e) => set('firstName', e.target.value)} error={errors.firstName} autoComplete="off" />
        <Input label="Soyad" required value={f.lastName} onChange={(e) => set('lastName', e.target.value)} error={errors.lastName} autoComplete="off" />
        <Input label="Telefon" required type="tel" inputMode="tel" placeholder="05xx xxx xx xx" value={f.phone} onChange={(e) => set('phone', e.target.value)} error={errors.phone} />
        <Input label="E-posta" type="email" placeholder="ornek@eposta.com" value={f.email} onChange={(e) => set('email', e.target.value)} error={errors.email} />
        {duplicateId && (
          <p className="text-sm text-cocoa sm:col-span-2">
            Bu numara zaten kayıtlı.{' '}
            <Link to={`/panel/danisanlar/${duplicateId}`} onClick={onClose} className="font-semibold underline underline-offset-2">Mevcut danışanı aç</Link>
          </p>
        )}
        <Input label="Doğum tarihi" hint="İsteğe bağlı" type="date" max={todayStr()} value={f.birthDate} onChange={(e) => set('birthDate', e.target.value)} error={errors.birthDate} />
        <Input label="İlk görüşme tarihi" type="date" value={f.firstVisitDate} onChange={(e) => set('firstVisitDate', e.target.value)} error={errors.firstVisitDate} />
        <Select
          label="Görüşme türü tercihi"
          value={f.preferredMeetingType}
          onChange={(e) => set('preferredMeetingType', e.target.value as FormState['preferredMeetingType'])}
          placeholder="Belirtilmedi"
          options={Object.entries(MEETING_TYPE_LABEL).map(([value, label]) => ({ value, label }))}
        />
        {editing && (
          <Select
            label="Durum"
            value={f.status}
            onChange={(e) => set('status', e.target.value as Client['status'])}
            options={CLIENT_STATUSES.map((s) => ({ value: s, label: CLIENT_STATUS_LABEL[s] }))}
          />
        )}
        <Textarea
          wrapperClassName="sm:col-span-2"
          label="Dahili not"
          hint="Yönetimsel notlar için (ör. ulaşılabilir saatler). Klinik notları Görüşme Notları sekmesinde tutun; orada şifreli saklanır."
          rows={3}
          value={f.internalNote}
          onChange={(e) => set('internalNote', e.target.value)}
          error={errors.internalNote}
        />
        {!editing && (
          <Checkbox
            className="sm:col-span-2"
            label="KVKK aydınlatma metni danışana sunuldu"
            description="İşaretlerseniz sunulma tarihi bugünün tarihi olarak kaydedilir."
            checked={f.kvkkNoticeGiven}
            onChange={(e) => set('kvkkNoticeGiven', e.target.checked)}
          />
        )}
      </form>
    </Modal>
  );
}
