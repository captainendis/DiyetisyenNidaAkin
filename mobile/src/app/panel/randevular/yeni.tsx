// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Yeni randevu: mevcut danışan seçimi veya yeni kişi, tür (diyet/pilates), hizmet, gün + saat, durum, not.
 * Parametreler: clientId, date, time. Web: NewAppointmentModal.
 */
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { MEETING_TYPE_LABEL, PILATES_FORMAT_LABEL, type AppointmentKind, type MeetingType, type PilatesFormat } from '@shared/constants';
import { todayStr } from '@shared/time';
import { Button, DateField, Empty, Notice, Screen, Section, Segmented, SelectField, SwitchField, T, TextField, useToast } from '@/components/ui';
import { api, ApiError, errorMessage } from '@/lib/api';
import { useStaff } from '@/lib/auth';
import { useApiMutation, useApiQuery } from '@/lib/query';
import { space } from '@/theme';
import { ClientPicker, type ClientLite, type Contact } from '@/features/appointments/ClientPicker';
import { SlotPicker } from '@/features/appointments/SlotPicker';
import { APPOINTMENT_INVALIDATE, type AppointmentDTO } from '@/features/appointments/types';

interface ServiceLite {
  id: string;
  title: string;
  durationMinutes: number | null;
}

export default function NewAppointmentScreen() {
  const { can } = useStaff();
  const params = useLocalSearchParams<{ clientId?: string; date?: string; time?: string; kind?: string }>();
  const toast = useToast();

  const [client, setClient] = useState<ClientLite | null>(null);
  const [mode, setMode] = useState<'search' | 'new'>('search');
  const [contact, setContact] = useState<Contact>({ name: '', phone: '', email: '' });
  const [kind, setKind] = useState<AppointmentKind>(params.kind === 'PILATES' ? 'PILATES' : 'CONSULTATION');
  const [pilatesFormat, setPilatesFormat] = useState<PilatesFormat>('PRIVATE');
  const [serviceId, setServiceId] = useState('');
  const [meetingType, setMeetingType] = useState<MeetingType>('IN_PERSON');
  const [duration, setDuration] = useState('');
  const [date, setDate] = useState(params.date ?? todayStr());
  const [time, setTime] = useState(params.time ?? '');
  const [outside, setOutside] = useState(false);
  const [status, setStatus] = useState<'CONFIRMED' | 'PENDING' | 'COMPLETED'>('CONFIRMED');
  // Gerçekleşmiş görüşmeyi sonradan kaydetme: geçmiş tarih/saat serbest girilir
  const recordingPast = status === 'COMPLETED';
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ?clientId= ile açıldıysa danışanı önceden seç
  const pre = useApiQuery(['clients', params.clientId], () => api.get<{ client: ClientLite }>(`/clients/${params.clientId}`), { enabled: !!params.clientId });
  useEffect(() => {
    const c = pre.data?.client;
    if (c?.id) setClient({ id: c.id, firstName: c.firstName, lastName: c.lastName, phone: c.phone, email: c.email ?? null });
  }, [pre.data]);

  const services = useApiQuery(['services'], () =>
    api
      .get<{ items: ServiceLite[] }>('/services')
      .then((r) => r.items ?? [])
      .catch(() => api.get<{ services: ServiceLite[] }>('/public/site').then((r) => r.services).catch(() => [] as ServiceLite[])),
  );
  const svc = services.data?.find((s) => s.id === serviceId);
  const effDuration = duration ? Number(duration) : svc?.durationMinutes ?? undefined;

  const create = useApiMutation((body: Record<string, unknown>) => api.post<{ appointment: AppointmentDTO }>('/appointments', body), {
    invalidate: APPOINTMENT_INVALIDATE,
    onSuccess: (r) => {
      toast(`Randevu oluşturuldu · ${r.appointment.contactName} · ${r.appointment.time}`);
      router.replace(`/panel/randevular/${r.appointment.id}`);
    },
  });

  if (!can('appointments:write')) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Yeni randevu' }} />
        <Empty icon="lock" title="Randevu oluşturma yetkiniz yok" />
      </Screen>
    );
  }

  const submit = () => {
    const errs: Record<string, string> = {};
    if (!client && mode === 'search') errs.client = 'Bir danışan seçin veya yeni kişi ekleyin';
    if (!client && mode === 'new') {
      if (contact.name.trim().split(/\s+/).length < 2) errs.contactName = 'Ad ve soyad girin';
      if (!contact.phone.trim()) errs.contactPhone = 'Telefon gerekli';
    }
    if (!date) errs.date = 'Tarih seçin';
    if (!time) errs.time = 'Saat seçin';
    if (duration && (!Number.isFinite(Number(duration)) || Number(duration) < 10 || Number(duration) > 240)) errs.durationMinutes = 'Süre 10–240 dk olmalı';
    setErrors(errs);
    if (Object.keys(errs).length) {
      toast('Eksik alanları kontrol edin', 'error');
      return;
    }
    create.mutate(
      {
        ...(client ? { clientId: client.id } : { contactName: contact.name.trim(), contactPhone: contact.phone, contactEmail: contact.email.trim() || null }),
        kind,
        pilatesFormat: kind === 'PILATES' ? pilatesFormat : null,
        serviceId: kind === 'PILATES' ? null : serviceId || null,
        date,
        time,
        durationMinutes: duration ? Number(duration) : undefined,
        meetingType: kind === 'PILATES' ? 'IN_PERSON' : meetingType,
        status,
        internalNote: note.trim() || null,
        allowOutsideHours: outside,
      },
      {
        onError: (e) => {
          if (e instanceof ApiError && Object.keys(e.fields).length) setErrors(e.fields);
          toast(errorMessage(e), 'error');
        },
      },
    );
  };

  return (
    <Screen footer={<Button title="Randevuyu oluştur" full loading={create.isPending} onPress={submit} />}>
      <Stack.Screen options={{ title: 'Yeni randevu' }} />
      <View style={{ marginBottom: space.lg }}>
        <Notice tone="info" text="Çakışma ve çalışma saati kontrolleri kaydederken otomatik yapılır." />
      </View>

      <Section title="Danışan">
        <ClientPicker client={client} setClient={setClient} mode={mode} setMode={setMode} contact={contact} setContact={setContact} errors={errors} />
      </Section>

      <Section title="Randevu türü">
        <View style={{ gap: space.md }}>
          <Segmented<AppointmentKind> value={kind} onChange={setKind} options={[{ value: 'CONSULTATION', label: 'Diyet' }, { value: 'PILATES', label: 'Pilates' }]} />
          {kind === 'PILATES' ? (
            <>
              <T variant="caption">Birebir ya da deneme dersi için. Grup dersleri “Pilates” ekranından eklenir.</T>
              <SelectField<PilatesFormat>
                label="Ders türü"
                value={pilatesFormat}
                onChange={setPilatesFormat}
                options={(['PRIVATE', 'GROUP'] as const).map((f) => ({ value: f, label: PILATES_FORMAT_LABEL[f] }))}
              />
            </>
          ) : (
            <SelectField<string>
              label="Hizmet"
              value={serviceId}
              onChange={setServiceId}
              options={[{ value: '', label: 'Belirtilmedi' }, ...(services.data ?? []).map((s) => ({ value: s.id, label: s.title }))]}
            />
          )}
          <SelectField<MeetingType>
            label="Görüşme türü"
            value={kind === 'PILATES' ? 'IN_PERSON' : meetingType}
            onChange={setMeetingType}
            disabled={kind === 'PILATES'}
            options={(['IN_PERSON', 'ONLINE'] as const).map((m) => ({ value: m, label: MEETING_TYPE_LABEL[m] }))}
          />
          <TextField
            label="Süre (dk)"
            value={duration}
            onChange={(v) => setDuration(v.replace(/\D/g, ''))}
            keyboardType="number-pad"
            placeholder={effDuration ? String(effDuration) : 'Takvim varsayılanı'}
            error={errors.durationMinutes}
            maxLength={3}
          />
        </View>
      </Section>

      <Section title="Tarih ve saat">
        <View style={{ gap: space.md }}>
          <DateField
            label="Tarih"
            value={date}
            minimumDate={recordingPast ? undefined : todayStr()}
            error={errors.date}
            onChange={(d) => {
              setDate(d);
              setTime('');
            }}
          />
          {recordingPast ? (
            <T variant="caption">Gerçekleşmiş bir görüşme kaydediliyor: görüşmenin yapıldığı tarih ve saati girin. Çakışma kontrolü yine yapılır.</T>
          ) : (
            <SwitchField
              label="Çalışma saatleri dışında özel randevu"
              value={outside}
              onChange={(v) => {
                setOutside(v);
                setTime('');
              }}
            />
          )}
          <SlotPicker date={date} duration={effDuration} value={time} onChange={setTime} freeTime={outside || recordingPast} error={errors.time} />
        </View>
      </Section>

      <Section title="Durum ve not">
        <View style={{ gap: space.md }}>
          <Segmented<'CONFIRMED' | 'PENDING' | 'COMPLETED'>
            value={status}
            onChange={(v) => {
              setStatus(v);
              setTime('');
            }}
            options={[
              { value: 'CONFIRMED', label: 'Onaylandı' },
              { value: 'PENDING', label: 'Onay bekliyor' },
              { value: 'COMPLETED', label: 'Tamamlandı' },
            ]}
          />
          {recordingPast ? <T variant="caption">“Tamamlandı”: gerçekleşmiş bir görüşmeyi sonradan kaydetmek için.</T> : null}
          <TextField label="Dahili not" value={note} onChange={setNote} rows={3} maxLength={2000} placeholder="Yalnızca panelde görünür" error={errors.internalNote} />
        </View>
      </Section>
    </Screen>
  );
}
