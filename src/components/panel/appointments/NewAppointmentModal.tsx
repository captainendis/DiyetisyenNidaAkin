// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Yeni randevu: mevcut danışan seçimi veya yeni kişi, hizmet, gün + saat, tür, durum, not */
import { useEffect, useRef, useState } from 'react';
import { Search, UserPlus, X } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useDebounced } from '@/hooks/useApi';
import { formatPhone, todayStr } from '@/lib/format';
import { MEETING_TYPE_LABEL, PILATES_FORMAT_LABEL, type AppointmentKind, type MeetingType, type PilatesFormat } from '@shared/constants';
import { Button, Input, Modal, Select, Switch, Textarea, useFeedback } from '../ui';
import { SlotPicker } from './SlotPicker';
import type { AppointmentDTO } from './types';

interface ClientLite { id: string; firstName: string; lastName: string; phone: string; email: string | null }
interface ServiceLite { id: string; title: string; durationMinutes: number | null }

export default function NewAppointmentModal({
  open, onClose, onCreated, initial,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (a: AppointmentDTO) => void;
  initial?: { date?: string; time?: string; clientId?: string; kind?: AppointmentKind };
}) {
  const fb = useFeedback();
  const [client, setClient] = useState<ClientLite | null>(null);
  const [mode, setMode] = useState<'search' | 'new'>('search');
  const [q, setQ] = useState('');
  const dq = useDebounced(q, 250);
  const [results, setResults] = useState<ClientLite[]>([]);
  const [searchState, setSearchState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [contact, setContact] = useState({ name: '', phone: '', email: '' });
  const [services, setServices] = useState<ServiceLite[]>([]);
  const [serviceId, setServiceId] = useState('');
  const [date, setDate] = useState(todayStr());
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState('');
  const [meetingType, setMeetingType] = useState<MeetingType>('IN_PERSON');
  const [kind, setKind] = useState<AppointmentKind>('CONSULTATION');
  const [pilatesFormat, setPilatesFormat] = useState<PilatesFormat>('PRIVATE');
  const [status, setStatus] = useState<'CONFIRMED' | 'PENDING' | 'COMPLETED'>('CONFIRMED');
  // Gerçekleşmiş görüşmeyi sonradan kaydetme: geçmiş tarih/saat serbest girilir
  const recordingPast = status === 'COMPLETED';
  const [outside, setOutside] = useState(false);
  const [note, setNote] = useState('');
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const searchRef = useRef<HTMLInputElement>(null);
  // Modal ilk odaklanabilir öğeye ("Yeni kişi") odaklanır; arama alanı daha doğal başlangıç noktası
  useEffect(() => {
    if (!open || initial?.clientId) return;
    const t = setTimeout(() => searchRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [open, initial?.clientId]);

  // Açılışta sıfırla + başlangıç değerleri
  useEffect(() => {
    if (!open) return;
    setClient(null);
    setMode('search');
    setQ('');
    setResults([]);
    setContact({ name: '', phone: '', email: '' });
    setServiceId('');
    setDate(initial?.date ?? todayStr());
    setTime(initial?.time ?? '');
    setDuration('');
    setMeetingType('IN_PERSON');
    setKind(initial?.kind ?? 'CONSULTATION');
    setPilatesFormat('PRIVATE');
    setStatus('CONFIRMED');
    setOutside(false);
    setNote('');
    setErrors({});
    if (initial?.clientId) {
      api
        .get<{ client?: ClientLite } & Partial<ClientLite>>(`/clients/${initial.clientId}`)
        .then((r) => {
          const c = (r.client ?? r) as ClientLite;
          if (c?.id) setClient({ id: c.id, firstName: c.firstName, lastName: c.lastName, phone: c.phone, email: c.email ?? null });
        })
        .catch(() => {});
    }
    api
      .get<{ items: ServiceLite[] }>('/services')
      .then((r) => setServices(r.items ?? []))
      .catch(() =>
        api
          .get<{ services: ServiceLite[] }>('/public/site')
          .then((r) => setServices(r.services))
          .catch(() => setServices([])),
      );
  }, [open, initial?.date, initial?.time, initial?.clientId, initial?.kind]);

  useEffect(() => {
    if (!open || mode !== 'search' || client) return;
    if (dq.trim().length < 2) {
      setResults([]);
      setSearchState('idle');
      return;
    }
    let live = true;
    setSearchState('loading');
    api
      .get<{ items: ClientLite[] }>('/clients', { q: dq.trim(), pageSize: 8 })
      .then((r) => {
        if (!live) return;
        setResults(r.items ?? []);
        setSearchState('idle');
      })
      .catch(() => live && setSearchState('error'));
    return () => {
      live = false;
    };
  }, [dq, open, mode, client]);

  const svc = services.find((s) => s.id === serviceId);
  const effDuration = duration ? Number(duration) : svc?.durationMinutes ?? undefined;

  const submit = async () => {
    const errs: Record<string, string> = {};
    if (!client && mode === 'search') errs.client = 'Bir danışan seçin veya yeni kişi ekleyin';
    if (mode === 'new') {
      if (contact.name.trim().split(/\s+/).length < 2) errs.contactName = 'Ad ve soyad girin';
      if (!contact.phone.trim()) errs.contactPhone = 'Telefon gerekli';
    }
    if (!date) errs.date = 'Tarih seçin';
    if (!time) errs.time = 'Saat seçin';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setPending(true);
    try {
      const body = {
        ...(client ? { clientId: client.id } : { contactName: contact.name.trim(), contactPhone: contact.phone, contactEmail: contact.email || null }),
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
      };
      const r = await api.post<{ appointment: AppointmentDTO }>('/appointments', body);
      fb.success('Randevu oluşturuldu', `${r.appointment.contactName} · ${r.appointment.time}`);
      onCreated?.(r.appointment);
      onClose();
    } catch (e) {
      if (e instanceof ApiError) {
        if (Object.keys(e.fields).length) setErrors(e.fields);
        fb.error('Randevu oluşturulamadı', e.message);
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
      title="Yeni randevu"
      description="Çakışma ve çalışma saati kontrolleri kaydederken otomatik yapılır."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Vazgeç</Button>
          <Button onClick={submit} loading={pending}>Randevuyu oluştur</Button>
        </>
      }
    >
      <div className="space-y-6">
        {/* Danışan */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[0.8rem] font-semibold text-cocoa">Danışan</p>
            {!client && (
              <button type="button" onClick={() => setMode(mode === 'search' ? 'new' : 'search')} className="inline-flex items-center gap-1.5 text-[0.8rem] font-semibold text-cocoa hover:underline">
                {mode === 'search' ? <><UserPlus className="h-3.5 w-3.5" /> Yeni kişi</> : <><Search className="h-3.5 w-3.5" /> Kayıtlı danışan ara</>}
              </button>
            )}
          </div>
          {client ? (
            <div className="flex items-center justify-between rounded-lg border border-panel-line bg-panel-bg/60 px-3.5 py-2.5">
              <div>
                <p className="text-sm font-semibold text-espresso">{client.firstName} {client.lastName}</p>
                <p className="text-[0.78rem] text-panel-muted tabular">{formatPhone(client.phone)}{client.email ? ` · ${client.email}` : ''}</p>
              </div>
              <button type="button" onClick={() => setClient(null)} aria-label="Danışan seçimini kaldır" className="rounded p-1 text-panel-muted hover:bg-white hover:text-espresso">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : mode === 'search' ? (
            <div>
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-panel-muted" />
                <input
                  ref={searchRef}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Ad, soyad veya telefon ile arayın"
                  aria-label="Danışan ara"
                  aria-invalid={!!errors.client}
                  className="h-10 w-full rounded-lg border border-panel-line bg-white pr-3 pl-9 text-sm focus:border-cocoa focus:outline-none aria-[invalid=true]:border-danger"
                />
              </div>
              {errors.client && <p className="mt-1.5 text-[0.78rem] text-danger-ink">{errors.client}</p>}
              {searchState === 'error' && <p className="mt-2 text-[0.8rem] text-panel-muted">Danışan araması şu anda kullanılamıyor. “Yeni kişi” ile devam edebilirsiniz.</p>}
              {results.length > 0 && (
                <ul className="mt-2 max-h-52 divide-y divide-panel-line overflow-y-auto rounded-lg border border-panel-line">
                  {results.map((c) => (
                    <li key={c.id}>
                      <button type="button" onClick={() => setClient(c)} className="flex w-full items-center justify-between px-3.5 py-2.5 text-left hover:bg-panel-bg">
                        <span className="text-sm font-semibold text-espresso">{c.firstName} {c.lastName}</span>
                        <span className="text-[0.78rem] text-panel-muted tabular">{formatPhone(c.phone)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {searchState === 'idle' && dq.trim().length >= 2 && results.length === 0 && (
                <p className="mt-2 text-[0.8rem] text-panel-muted">
                  Eşleşen danışan bulunamadı.{' '}
                  <button type="button" className="font-semibold text-cocoa underline" onClick={() => { setMode('new'); setContact((c) => ({ ...c, name: q })); }}>Yeni kişi olarak ekle</button>
                </p>
              )}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              <Input label="Ad soyad" required value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} error={errors.contactName} placeholder="Ad Soyad" />
              <Input label="Telefon" required type="tel" inputMode="tel" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} error={errors.contactPhone} placeholder="05xx xxx xx xx" />
              <Input label="E-posta" type="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} error={errors.contactEmail} placeholder="ornek@eposta.com" />
              <p className="text-[0.78rem] text-panel-muted sm:col-span-3">Bu telefonla kayıtlı danışan yoksa yeni danışan kaydı oluşturulur.</p>
            </div>
          )}
        </section>

        <section>
          <p className="mb-2 text-[0.8rem] font-semibold text-cocoa">Randevu türü</p>
          <div role="radiogroup" aria-label="Randevu türü" className="inline-flex rounded-lg bg-panel-bg p-1">
            {(['CONSULTATION', 'PILATES'] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => setKind(k)}
                className={kind === k ? 'rounded-md bg-white px-3 py-1.5 text-[0.82rem] font-semibold text-espresso shadow-sm' : 'rounded-md px-3 py-1.5 text-[0.82rem] font-semibold text-panel-muted hover:text-cocoa'}
              >
                {k === 'PILATES' ? 'Pilates' : 'Diyet'}
              </button>
            ))}
          </div>
          {kind === 'PILATES' && (
            <p className="mt-2 text-[0.78rem] text-panel-muted">Birebir ya da deneme dersi için. Grup dersleri “Pilates dersi” ve “Ders programı” ile eklenir.</p>
          )}
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          {kind === 'PILATES' ? (
            <Select
              label="Ders türü"
              value={pilatesFormat}
              onChange={(e) => setPilatesFormat(e.target.value as PilatesFormat)}
              options={(['PRIVATE', 'GROUP'] as const).map((f) => ({ value: f, label: PILATES_FORMAT_LABEL[f] }))}
            />
          ) : (
          <Select label="Hizmet" value={serviceId} onChange={(e) => setServiceId(e.target.value)} placeholder="Belirtilmedi" options={services.map((s) => ({ value: s.id, label: s.title }))} />
          )}
          <Select
            label="Görüşme türü"
            value={kind === 'PILATES' ? 'IN_PERSON' : meetingType}
            onChange={(e) => setMeetingType(e.target.value as MeetingType)}
            options={(['IN_PERSON', 'ONLINE'] as const).map((m) => ({ value: m, label: MEETING_TYPE_LABEL[m] }))}
            disabled={kind === 'PILATES'}
          />
          <Input label="Süre (dk)" type="number" min={10} max={240} step={5} value={duration} onChange={(e) => setDuration(e.target.value)} placeholder={effDuration ? String(effDuration) : 'Takvim varsayılanı'} />
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-end gap-4">
            <Input label="Tarih" type="date" min={recordingPast ? undefined : todayStr()} max={recordingPast ? todayStr() : undefined} value={date} onChange={(e) => { setDate(e.target.value); setTime(''); }} error={errors.date} wrapperClassName="w-44" className="tabular" />
            {!recordingPast && <div className="pb-2"><Switch checked={outside} onChange={(v) => { setOutside(v); setTime(''); }} label="Çalışma saatleri dışında özel randevu" /></div>}
          </div>
          <SlotPicker date={date} duration={effDuration} value={time} onChange={setTime} freeTime={outside || recordingPast} />
          {recordingPast && <p className="text-[0.78rem] text-panel-muted">Gerçekleşmiş bir görüşme kaydediliyor: görüşmenin yapıldığı tarih ve saati girin. Çakışma kontrolü yine yapılır.</p>}
          {errors.time && <p className="text-[0.78rem] text-danger-ink">{errors.time}</p>}
        </section>

        <section className="grid gap-3 sm:grid-cols-[14rem_1fr]">
          <Select
            label="Durum"
            value={status}
            onChange={(e) => { setStatus(e.target.value as 'CONFIRMED' | 'PENDING' | 'COMPLETED'); setTime(''); }}
            options={[
              { value: 'CONFIRMED', label: 'Onaylandı' },
              { value: 'PENDING', label: 'Onay bekliyor' },
              { value: 'COMPLETED', label: 'Tamamlandı (geçmiş görüşmeyi kaydet)' },
            ]}
          />
          <Textarea label="Dahili not" rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} placeholder="Yalnızca panelde görünür" />
        </section>
      </div>
    </Modal>
  );
}
