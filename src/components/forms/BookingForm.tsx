// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Randevu talep formu — 3 adım + sonuç.
 *  1) Görüşme: konu (beslenme görüşmesi / pilates), hizmet ya da ders türü, görüşme tercihi
 *  2) Zaman: müsait gün/saat seçimi ya da "saat seçmeden iletişim talebi";
 *     pilatesde yalnızca tercih edilen günler ve gün içi aralık (ders saati birlikte planlanır)
 *  3) Bilgiler: ad soyad, telefon, e-posta, mesaj, KVKK
 * Sonuç ekranı dürüsttür: talep "onay bekliyor" olarak alınır; kesin randevu gösterilmez.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from '@/lib/router';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { DateTime } from 'luxon';
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Loader2, PhoneCall } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useSite } from '@/data/SiteContext';
import { publicAppointmentRequestSchema } from '@shared/schemas';
import {
  DAYPARTS, DAYPART_HOURS, DAYPART_LABEL, MEETING_TYPE_LABEL, PILATES_FORMAT_LABEL, TIME_ZONE, WEEKDAY_LABEL, pilatesPreferenceText,
  type AppointmentKind, type Daypart, type MeetingType, type PilatesFormat,
} from '@shared/constants';
import { ServiceIcon } from '@/components/icons/ServiceIcon';
import { WhatsappIcon } from '@/components/icons/SocialIcons';
import { cn } from '@/lib/text';
import { CtaButton } from './Button';
import { StepIndicator, type Step } from './StepIndicator';
export { StepIndicator };

interface DaysRes { days: { date: string; available: number }[]; leadTimeHours: number; maxDaysAhead: number }
interface SlotsRes { date: string; closedReason: string | null; slots: { time: string; endTime: string; available: boolean }[] }
interface SubmitRes { ok: true; status: 'PENDING' | 'NEW_REQUEST'; reference: string; whatsapp: string | null }


const fieldCls =
  'w-full rounded-none border-0 border-b border-espresso/20 bg-transparent px-0 py-3 text-[1rem] text-espresso placeholder:text-taupe transition-colors focus:border-espresso focus:outline-none focus:ring-0 aria-[invalid=true]:border-danger';

function FieldShell({ label, error, htmlFor, children, hint }: { label: string; error?: string; htmlFor: string; children: ReactNode; hint?: string }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="text-[0.7rem] font-semibold tracking-[0.16em] text-taupe uppercase">{label}</label>
      {children}
      {error ? <p className="mt-1.5 text-[0.8rem] text-danger-ink" role="alert">{error}</p> : hint ? <p className="mt-1.5 text-[0.8rem] text-taupe">{hint}</p> : null}
    </div>
  );
}

function MonthCalendar({
  month, onMonth, days, selected, onSelect, minMonth, maxMonth, loading,
}: {
  month: DateTime; onMonth: (m: DateTime) => void; days: Map<string, number>; selected: string | null; onSelect: (d: string) => void;
  minMonth: DateTime; maxMonth: DateTime; loading: boolean;
}) {
  const start = month.startOf('month');
  const lead = start.weekday - 1; // Pazartesi başlangıçlı
  const total = start.daysInMonth ?? 30;
  const cells: (DateTime | null)[] = [...Array(lead).fill(null), ...Array.from({ length: total }, (_, i) => start.plus({ days: i }))];
  const canPrev = start > minMonth.startOf('month');
  const canNext = start < maxMonth.startOf('month');
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="font-display text-[1.45rem] font-medium text-espresso capitalize">{start.setLocale('tr').toFormat('LLLL yyyy')}</p>
        <div className="flex gap-1">
          <button type="button" onClick={() => onMonth(start.minus({ months: 1 }))} disabled={!canPrev} aria-label="Önceki ay" className="rounded-full p-2 text-espresso hover:bg-espresso/5 disabled:opacity-25">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => onMonth(start.plus({ months: 1 }))} disabled={!canNext} aria-label="Sonraki ay" className="rounded-full p-2 text-espresso hover:bg-espresso/5 disabled:opacity-25">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 text-center text-[0.68rem] font-semibold tracking-[0.12em] text-taupe uppercase">
        {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map((d) => <span key={d} className="pb-2">{d}</span>)}
      </div>
      <div className={cn('grid grid-cols-7 gap-1 transition-opacity', loading && 'opacity-40')} role="grid">
        {cells.map((c, i) => {
          if (!c) return <span key={i} />;
          const iso = c.toISODate()!;
          const avail = days.get(iso) ?? 0;
          const isSel = selected === iso;
          return (
            <button
              key={iso}
              type="button"
              disabled={avail === 0}
              onClick={() => onSelect(iso)}
              aria-pressed={isSel}
              aria-label={`${c.setLocale('tr').toFormat('d MMMM cccc')}${avail ? `, ${avail} uygun saat` : ', uygun saat yok'}`}
              className={cn(
                'relative flex aspect-square items-center justify-center rounded-full text-[0.92rem] tabular-nums transition-colors',
                isSel ? 'bg-espresso text-cream' : avail ? 'text-espresso hover:bg-sand' : 'text-taupe/35',
              )}
            >
              {c.day}
              {avail > 0 && !isSel && <span className="absolute bottom-1.5 h-1 w-1 rounded-full bg-rose-deep" aria-hidden />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const PILATES_FORMAT_NOTE: Record<PilatesFormat, string> = {
  GROUP: 'Küçük gruplarla, aynı seviyedeki kişilerle ders.',
  PRIVATE: 'Yalnızca size ayrılmış, birebir ders.',
};

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

export function BookingForm({
  initialServiceId, initialKind = 'CONSULTATION', variant = 'modal', onStepChange,
}: { initialServiceId?: string | null; initialKind?: AppointmentKind; variant?: 'modal' | 'page'; onStepChange?: (s: Step) => void }) {
  const { site } = useSite();
  const reduce = useReducedMotion();
  const cfg = site.settings.appointment;
  const meetingOptions = (['IN_PERSON', 'ONLINE'] as MeetingType[]).filter((m) => (m === 'IN_PERSON' ? cfg.inPersonEnabled : cfg.onlineEnabled));

  const [step, setStep] = useState<Step>(1);
  const [kind, setKind] = useState<AppointmentKind>(initialKind);
  const pilates = kind === 'PILATES';
  const [pilatesFormat, setPilatesFormat] = useState<PilatesFormat | null>(null);
  const [prefDays, setPrefDays] = useState<number[]>([]);
  const [prefParts, setPrefParts] = useState<Daypart[]>([]);
  const [serviceId, setServiceId] = useState<string | null>(initialServiceId ?? null);
  const [meetingType, setMeetingType] = useState<MeetingType | null>(meetingOptions.length === 1 ? meetingOptions[0] : null);
  const [mode, setMode] = useState<'slot' | 'callback'>(initialKind === 'PILATES' ? 'callback' : 'slot');
  const today = DateTime.now().setZone(TIME_ZONE).startOf('day');
  const [month, setMonth] = useState<DateTime>(today.startOf("month"));
  const [days, setDays] = useState<Map<string, number>>(new Map());
  const [daysLoading, setDaysLoading] = useState(false);
  const [daysError, setDaysError] = useState(false);
  const [anyAvailable, setAnyAvailable] = useState<boolean | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<SlotsRes | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [time, setTime] = useState<string | null>(null);
  const [form, setForm] = useState({ fullName: '', phone: '', email: '', message: '', kvkkNotice: false, explicitConsent: false, website: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitRes | null>(null);

  useEffect(() => onStepChange?.(step), [step, onStepChange]);

  const maxDate = today.plus({ days: cfg.maxDaysAhead });
  const service = site.services.find((s) => s.id === serviceId) ?? null;

  // Ay görünümündeki müsait günler
  useEffect(() => {
    if (step !== 2 || mode !== 'slot') return;
    const from = DateTime.max(month.startOf('month'), today).toISODate()!;
    const to = DateTime.min(month.endOf('month'), maxDate).toISODate()!;
    if (from > to) {
      setDays(new Map());
      return;
    }
    let alive = true;
    setDaysLoading(true);
    setDaysError(false);
    api
      .get<DaysRes>('/public/availability/days', { from, to, serviceId: serviceId ?? undefined })
      .then((r) => {
        if (!alive) return;
        const m = new Map(r.days.map((d) => [d.date, d.available]));
        setDays(m);
        if (anyAvailable === null) setAnyAvailable(r.days.some((d) => d.available > 0) ? true : null);
      })
      .catch(() => alive && setDaysError(true))
      .finally(() => alive && setDaysLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, mode, month, serviceId]);

  // Tüm aralıkta hiç müsait gün yoksa (takvim kapalı) bunu bir kez tespit et
  useEffect(() => {
    if (step !== 2 || anyAvailable !== null || pilates) return;
    api
      .get<DaysRes>('/public/availability/days', { from: today.toISODate()!, to: maxDate.toISODate()!, serviceId: serviceId ?? undefined })
      .then((r) => setAnyAvailable(r.days.some((d) => d.available > 0)))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const loadSlots = (d: string) => {
    setSlotsLoading(true);
    setTime(null);
    api
      .get<SlotsRes>('/public/availability/slots', { date: d, serviceId: serviceId ?? undefined })
      .then(setSlots)
      .catch(() => setSlots({ date: d, closedReason: 'Saatler şu an yüklenemedi.', slots: [] }))
      .finally(() => setSlotsLoading(false));
  };

  const pickDate = (d: string) => {
    setDate(d);
    setNotice(null);
    loadSlots(d);
  };

  const goNext = () => {
    setNotice(null);
    if (step === 1) {
      if (pilates) {
        if (!pilatesFormat) {
          setErrors({ pilatesFormat: 'Grup dersi mi birebir ders mi istediğinizi seçin' });
          return;
        }
        setErrors({});
        setStep(2);
        return;
      }
      if (!meetingType) {
        setErrors({ meetingType: 'Görüşme tercihinizi seçin' });
        return;
      }
      setErrors({});
      setStep(2);
    } else if (step === 2) {
      if (mode === 'slot' && (!date || !time)) {
        setErrors({ time: 'Lütfen bir gün ve saat seçin' });
        return;
      }
      setErrors({});
      setStep(3);
    }
  };

  const submit = async () => {
    const payload = {
      fullName: form.fullName,
      phone: form.phone,
      email: form.email,
      meetingType: pilates ? ('IN_PERSON' as const) : (meetingType ?? undefined),
      kind,
      pilatesFormat: pilates ? pilatesFormat : null,
      preferredDays: pilates ? prefDays : null,
      preferredDayparts: pilates ? prefParts : null,
      serviceId: pilates ? null : serviceId,
      mode: pilates ? ('callback' as const) : mode,
      date: !pilates && mode === 'slot' ? date : null,
      time: !pilates && mode === 'slot' ? time : null,
      message: form.message || null,
      kvkkNotice: form.kvkkNotice,
      explicitConsent: form.explicitConsent,
      website: form.website,
    };
    const parsed = publicAppointmentRequestSchema.safeParse(payload);
    if (!parsed.success) {
      const f: Record<string, string> = {};
      for (const i of parsed.error.issues) f[String(i.path[0] ?? '_')] ??= i.message;
      setErrors(f);
      if (f.meetingType || f.pilatesFormat) setStep(1);
      else if (f.time) setStep(2);
      return;
    }
    setErrors({});
    setSubmitting(true);
    setNotice(null);
    try {
      const res = await api.post<SubmitRes>('/public/appointments', payload);
      setResult(res);
      setStep(4);
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 422 && Object.keys(e.fields).length) setErrors(e.fields);
        else if (e.status === 409) {
          setNotice(e.message);
          setStep(2);
          if (date) loadSlots(date);
        } else setNotice(e.message);
      } else setNotice('Talebiniz gönderilemedi. Lütfen tekrar deneyin.');
    } finally {
      setSubmitting(false);
    }
  };

  const whatsappNumber = result?.whatsapp ?? site.settings.contact.whatsapp;
  const waText = encodeURIComponent(
    `Merhaba, web sitesinden ${pilates ? 'pilates' : 'randevu'} talebi oluşturdum${result ? ` (Referans: ${result.reference})` : ''}.`,
  );

  const slide = useMemo(
    () => (reduce ? {} : { initial: { opacity: 0, x: 18 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -18 }, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const } }),
    [reduce],
  );

  const selectedLabel = date ? DateTime.fromISO(date, { zone: TIME_ZONE }).setLocale('tr').toFormat('d MMMM cccc') : null;

  return (
    <div className="text-espresso">
      {step < 4 && variant === 'page' && <div className="mb-10"><StepIndicator step={step} /></div>}
      {notice && (
        <div className="mb-6 border-l-2 border-danger bg-danger/[0.06] px-4 py-3 text-[0.9rem] text-[#8a4545]" role="alert">{notice}</div>
      )}
      <AnimatePresence mode="wait" initial={false}>
        {step === 1 && (
          <motion.div key="s1" {...slide}>
            <h3 className="font-display text-[1.9rem] leading-tight font-medium sm:text-[2.2rem]">Size nasıl yardımcı olabilirim?</h3>

            <div className="mt-6 inline-flex border border-espresso/15 p-1 text-[0.92rem]" role="radiogroup" aria-label="Talep konusu">
              {(['CONSULTATION', 'PILATES'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={kind === k}
                  onClick={() => {
                    setKind(k);
                    setMode(k === 'PILATES' ? 'callback' : 'slot');
                    setErrors({});
                  }}
                  className={cn('px-4 py-2 transition-colors', kind === k ? 'bg-espresso text-cream' : 'text-taupe hover:text-espresso')}
                >
                  {k === 'PILATES' ? 'Pilates dersi' : 'Beslenme danışmanlığı'}
                </button>
              ))}
            </div>

            {pilates ? (
              <fieldset className="mt-7">
                <legend className="text-[0.95rem] text-taupe">Grup dersine mi katılmak istersiniz, birebir ders mi?</legend>
                <div className="mt-4 grid gap-px overflow-hidden border border-espresso/12 bg-espresso/12 sm:grid-cols-2">
                  {(['GROUP', 'PRIVATE'] as const).map((f) => {
                    const active = pilatesFormat === f;
                    return (
                      <button
                        key={f}
                        type="button"
                        onClick={() => {
                          setPilatesFormat(f);
                          setErrors({});
                        }}
                        aria-pressed={active}
                        className={cn('px-5 py-4 text-left transition-colors', active ? 'bg-espresso text-cream' : 'bg-ivory hover:bg-cream')}
                      >
                        <span className="block font-display text-[1.3rem] leading-tight">{PILATES_FORMAT_LABEL[f]}</span>
                        <span className={cn('mt-1 block text-[0.85rem]', active ? 'text-cream/75' : 'text-taupe')}>{PILATES_FORMAT_NOTE[f]}</span>
                      </button>
                    );
                  })}
                </div>
                {errors.pilatesFormat && <p className="mt-2 text-[0.8rem] text-danger-ink" role="alert">{errors.pilatesFormat}</p>}
                {site.settings.contact.venueName && (
                  <p className="mt-4 max-w-md text-[0.85rem] leading-relaxed text-taupe">
                    Dersler {site.settings.contact.venueName}’da yapılır{site.settings.contact.district ? ` (${site.settings.contact.district})` : ''}.
                  </p>
                )}
              </fieldset>
            ) : (
            <>
            <p className="mt-6 text-[0.95rem] text-taupe">Bir hizmet seçebilir ya da bu adımı boş bırakabilirsiniz; ilk görüşmede birlikte netleştiririz.</p>

            <fieldset className="mt-5">
              <legend className="sr-only">Hizmet</legend>
              <div className="grid gap-px overflow-hidden border border-espresso/12 bg-espresso/12 sm:grid-cols-2">
                {[{ id: null as string | null, title: 'Henüz karar vermedim', icon: 'sprout' }, ...site.services.map((s) => ({ id: s.id as string | null, title: s.title, icon: s.icon }))].map((s, i, all) => {
                  const active = serviceId === s.id;
                  const spanLast = all.length % 2 === 1 && i === all.length - 1;
                  return (
                    <button
                      key={s.id ?? 'none'}
                      type="button"
                      onClick={() => setServiceId(s.id)}
                      aria-pressed={active}
                      className={cn('flex items-center gap-3.5 px-4 py-3.5 text-left text-[0.92rem] transition-colors', spanLast && 'sm:col-span-2', active ? 'bg-espresso text-cream' : 'bg-ivory hover:bg-cream')}
                    >
                      <ServiceIcon name={s.icon} className={cn('h-7 w-7 shrink-0', active ? 'text-rose' : 'text-gold-ink')} />
                      <span className="leading-snug">{s.title}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <fieldset className="mt-8">
              <legend className="text-[0.7rem] font-semibold tracking-[0.16em] text-taupe uppercase">Görüşme tercihi</legend>
              <div className="mt-3 flex flex-wrap gap-3">
                {meetingOptions.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setMeetingType(m);
                      setErrors({});
                    }}
                    aria-pressed={meetingType === m}
                    className={cn(
                      'min-w-36 border px-5 py-3 text-[0.95rem] transition-colors',
                      meetingType === m ? 'border-espresso bg-espresso text-cream' : 'border-espresso/20 hover:border-espresso/50',
                    )}
                  >
                    {MEETING_TYPE_LABEL[m]}
                  </button>
                ))}
              </div>
              {errors.meetingType && <p className="mt-2 text-[0.8rem] text-danger-ink" role="alert">{errors.meetingType}</p>}
              {meetingType === 'IN_PERSON' && site.settings.contact.venueName && (
                <p className="mt-3 max-w-md text-[0.85rem] leading-relaxed text-taupe">
                  Yüz yüze görüşmeler {site.settings.contact.venueName}’in üst katındaki danışmanlık alanında yapılır
                  {site.settings.contact.district ? ` (${site.settings.contact.district})` : ''}.
                </p>
              )}
            </fieldset>
            </>
            )}
          </motion.div>
        )}

        {step === 2 && pilates && (
          <motion.div key="s2p" {...slide}>
            <h3 className="font-display text-[1.9rem] leading-tight font-medium sm:text-[2.2rem]">Hangi zamanlar size uyar?</h3>
            <p className="mt-2 max-w-lg text-[0.95rem] leading-relaxed text-taupe">
              Ders saati, {pilatesFormat === 'GROUP' ? 'grupların doluluğuna' : 'takvime'} göre sizinle birlikte belirlenir. Boş bırakırsanız “fark etmez” olarak iletilir.
            </p>
            <fieldset className="mt-7">
              <legend className="text-[0.7rem] font-semibold tracking-[0.16em] text-taupe uppercase">Günler</legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={prefDays.includes(d)}
                    onClick={() => setPrefDays((l) => toggle(l, d))}
                    className={cn('border px-4 py-2.5 text-[0.92rem] transition-colors', prefDays.includes(d) ? 'border-espresso bg-espresso text-cream' : 'border-espresso/20 hover:border-espresso/50')}
                  >
                    {WEEKDAY_LABEL[d]}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset className="mt-7">
              <legend className="text-[0.7rem] font-semibold tracking-[0.16em] text-taupe uppercase">Gün içinde</legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {DAYPARTS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={prefParts.includes(p)}
                    onClick={() => setPrefParts((l) => toggle(l, p))}
                    className={cn('min-w-36 border px-4 py-2.5 text-left transition-colors', prefParts.includes(p) ? 'border-espresso bg-espresso text-cream' : 'border-espresso/20 hover:border-espresso/50')}
                  >
                    <span className="block text-[0.95rem]">{DAYPART_LABEL[p]}</span>
                    <span className={cn('block text-[0.78rem] tabular-nums', prefParts.includes(p) ? 'text-cream/70' : 'text-taupe')}>{DAYPART_HOURS[p]}</span>
                  </button>
                ))}
              </div>
            </fieldset>
          </motion.div>
        )}

        {step === 2 && !pilates && (
          <motion.div key="s2" {...slide}>
            <h3 className="font-display text-[1.9rem] leading-tight font-medium sm:text-[2.2rem]">Size uygun zamanı seçin</h3>
            {cfg.allowRequestWithoutTime && (
              <div className="mt-5 inline-flex border border-espresso/15 p-1 text-[0.85rem]" role="tablist">
                {(['slot', 'callback'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="tab"
                    aria-selected={mode === m}
                    onClick={() => {
                      setMode(m);
                      setErrors({});
                    }}
                    className={cn('px-4 py-2 transition-colors', mode === m ? 'bg-espresso text-cream' : 'text-taupe hover:text-espresso')}
                  >
                    {m === 'slot' ? 'Gün ve saat seç' : 'Saat seçmeden talep bırak'}
                  </button>
                ))}
              </div>
            )}

            {mode === 'callback' ? (
              <div className="mt-8 flex gap-5 border-t border-espresso/10 pt-8">
                <PhoneCall className="mt-1 h-6 w-6 shrink-0 text-gold-ink" strokeWidth={1.3} />
                <div>
                  <p className="font-display text-[1.4rem]">Sizin için uygun bir zamanı birlikte planlayalım.</p>
                  <p className="mt-2 max-w-md text-[0.95rem] leading-relaxed text-taupe">
                    Bilgilerinizi bırakın; talebiniz incelendikten sonra sizinle iletişime geçilerek görüşme zamanı belirlenir.
                  </p>
                </div>
              </div>
            ) : daysError ? (
              <div className="mt-8 border-t border-espresso/10 pt-8">
                <p className="font-display text-[1.4rem]">Takvim şu an yüklenemedi.</p>
                <p className="mt-2 max-w-md text-[0.95rem] text-taupe">Lütfen biraz sonra tekrar deneyin{cfg.allowRequestWithoutTime ? ' ya da saat seçmeden talep bırakın' : ''}.</p>
              </div>
            ) : anyAvailable === false ? (
              <div className="mt-8 border-t border-espresso/10 pt-8">
                <p className="font-display text-[1.4rem]">Çevrim içi takvimde şu an açık saat bulunmuyor.</p>
                <p className="mt-2 max-w-md text-[0.95rem] leading-relaxed text-taupe">
                  Uygun saatler yakında yayınlanacak. {cfg.allowRequestWithoutTime ? 'Dilerseniz şimdi bilgilerinizi bırakın; sizin için uygun zaman birlikte planlansın.' : ''}
                </p>
                {cfg.allowRequestWithoutTime && (
                  <button type="button" onClick={() => setMode('callback')} className="mt-5 border-b border-espresso pb-0.5 text-[0.95rem] font-medium">
                    Saat seçmeden talep bırak
                  </button>
                )}
              </div>
            ) : (
              <div className="mt-7 grid gap-8 md:grid-cols-[1.15fr_1fr] md:gap-10">
                <MonthCalendar
                  month={month}
                  onMonth={setMonth}
                  days={days}
                  selected={date}
                  onSelect={pickDate}
                  minMonth={today}
                  maxMonth={maxDate}
                  loading={daysLoading}
                />
                <div className="md:border-l md:border-espresso/10 md:pl-8">
                  {!date ? (
                    <p className="pt-2 text-[0.92rem] leading-relaxed text-taupe">Noktayla işaretli günlerden birini seçtiğinizde uygun saatler burada görünür.</p>
                  ) : (
                    <>
                      <p className="text-[0.7rem] font-semibold tracking-[0.16em] text-taupe uppercase">{selectedLabel}</p>
                      {slotsLoading ? (
                        <div className="mt-6 flex items-center gap-2 text-taupe"><Loader2 className="h-4 w-4 animate-spin" /> Saatler yükleniyor</div>
                      ) : slots && slots.slots.some((s) => s.available) ? (
                        <div className="mt-4 grid grid-cols-3 gap-2">
                          {slots.slots.filter((s) => s.available).map((s) => (
                            <button
                              key={s.time}
                              type="button"
                              onClick={() => {
                                setTime(s.time);
                                setErrors({});
                              }}
                              aria-pressed={time === s.time}
                              className={cn(
                                'border py-2.5 text-[0.92rem] tabular-nums transition-colors',
                                time === s.time ? 'border-espresso bg-espresso text-cream' : 'border-espresso/15 hover:border-espresso/50',
                              )}
                            >
                              {s.time}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-4 text-[0.92rem] text-taupe">{slots?.closedReason ?? 'Bu gün için uygun saat kalmadı.'}</p>
                      )}
                    </>
                  )}
                  {errors.time && <p className="mt-3 text-[0.8rem] text-danger-ink" role="alert">{errors.time}</p>}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {step === 3 && (
          <motion.div key="s3" {...slide}>
            <h3 className="font-display text-[1.9rem] leading-tight font-medium sm:text-[2.2rem]">Sizi nasıl tanıyalım?</h3>
            <p className="mt-2 text-[0.92rem] text-taupe">
              {pilates ? (
                <>Pilates · {pilatesFormat ? PILATES_FORMAT_LABEL[pilatesFormat] : ''} · {pilatesPreferenceText(prefDays, prefParts)}</>
              ) : (
                <>
                  {MEETING_TYPE_LABEL[meetingType ?? 'IN_PERSON']}
                  {service ? ` · ${service.title}` : ''}
                  {mode === 'slot' && selectedLabel ? ` · ${selectedLabel}, ${time}` : ' · Zaman birlikte planlanacak'}
                </>
              )}
            </p>
            <div className="mt-7 grid gap-6 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <FieldShell label="Ad Soyad" htmlFor="b-name" error={errors.fullName}>
                  <input id="b-name" autoComplete="name" className={fieldCls} value={form.fullName} aria-invalid={!!errors.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Adınız ve soyadınız" />
                </FieldShell>
              </div>
              <FieldShell label="Telefon" htmlFor="b-phone" error={errors.phone}>
                <input id="b-phone" type="tel" inputMode="tel" autoComplete="tel" className={fieldCls} value={form.phone} aria-invalid={!!errors.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="05xx xxx xx xx" />
              </FieldShell>
              <FieldShell label="E-posta" htmlFor="b-email" error={errors.email}>
                <input id="b-email" type="email" autoComplete="email" className={fieldCls} value={form.email} aria-invalid={!!errors.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="ornek@eposta.com" />
              </FieldShell>
              <div className="sm:col-span-2">
                <FieldShell label="Mesajınız (isteğe bağlı)" htmlFor="b-msg" error={errors.message} hint="Lütfen bu alanda sağlık durumunuza ilişkin ayrıntı paylaşmayın; bu bilgiler görüşmede konuşulur.">
                  <textarea id="b-msg" rows={3} className={cn(fieldCls, 'resize-none')} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder={pilates ? 'Ör. daha önce pilates yaptınız mı, hangi seviyedesiniz?' : 'Görüşme öncesi iletmek istedikleriniz'} maxLength={1000} />
                </FieldShell>
              </div>
            </div>
            {/* Bot tuzağı */}
            <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
              <label htmlFor="b-website">Web sitesi</label>
              <input id="b-website" tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
            </div>
            <div className="mt-8 space-y-4 border-t border-espresso/10 pt-6">
              <label className="flex cursor-pointer items-start gap-3 text-[0.88rem] leading-relaxed">
                <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-espresso" checked={form.kvkkNotice} onChange={(e) => setForm({ ...form, kvkkNotice: e.target.checked })} aria-invalid={!!errors.kvkkNotice} />
                <span>
                  Kişisel verilerimin işlenmesine ilişkin{' '}
                  <Link to="/kvkk-aydinlatma-metni" target="_blank" className="underline decoration-gold underline-offset-4">Aydınlatma Metni</Link>'ni okudum.
                  <span className="text-danger-ink"> *</span>
                </span>
              </label>
              {errors.kvkkNotice && <p className="-mt-2 pl-7 text-[0.8rem] text-danger-ink" role="alert">{errors.kvkkNotice}</p>}
              <label className="flex cursor-pointer items-start gap-3 text-[0.88rem] leading-relaxed text-taupe">
                <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-espresso" checked={form.explicitConsent} onChange={(e) => setForm({ ...form, explicitConsent: e.target.checked })} />
                <span>
                  (İsteğe bağlı) Mesajımda paylaştığım bilgilerin randevu talebimin değerlendirilmesi amacıyla işlenmesine{' '}
                  <Link to="/acik-riza-metni" target="_blank" className="underline decoration-gold underline-offset-4">Açık Rıza Metni</Link> kapsamında onay veriyorum.
                </span>
              </label>
            </div>
            <p className="mt-6 text-[0.82rem] leading-relaxed text-taupe">{cfg.formNote}</p>
          </motion.div>
        )}

        {step === 4 && result && (
          <motion.div key="s4" {...slide} className="py-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-full border border-gold text-gold-ink">
              <Check className="h-6 w-6" strokeWidth={1.4} />
            </span>
            <h3 className="mt-7 font-display text-[2.1rem] leading-tight font-medium sm:text-[2.6rem]">Talebiniz alındı.</h3>
            <p className="mt-2 text-[0.75rem] font-semibold tracking-[0.18em] text-rose-ink uppercase">Durum: Onay bekliyor</p>
            <p className="mt-5 max-w-lg text-[1rem] leading-relaxed text-cocoa/80">
              {pilates
                ? `Pilates talebiniz (${pilatesFormat ? PILATES_FORMAT_LABEL[pilatesFormat].toLocaleLowerCase('tr') : 'ders'}) bize ulaştı. ${pilatesFormat === 'GROUP' ? 'Size uygun bir grup' : 'Uygun bir ders saati'} belirlendiğinde sizinle iletişime geçilecek.`
                : result.status === 'NEW_REQUEST'
                ? 'İletişim talebiniz bize ulaştı. Talebiniz incelendikten sonra sizinle iletişime geçilerek görüşme zamanı birlikte belirlenecek.'
                : `${selectedLabel}, ${time} için talebiniz bize ulaştı. Bu henüz kesinleşmiş bir randevu değildir; uygunluk kontrolünden sonra sizinle iletişime geçilecek.`}
            </p>
            <dl className="mt-8 inline-flex flex-col border-t border-b border-espresso/10 py-4 pr-10">
              <dt className="text-[0.7rem] font-semibold tracking-[0.16em] text-taupe uppercase">Referans kodu</dt>
              <dd className="mt-1 font-display text-[1.6rem] tracking-[0.06em]">{result.reference}</dd>
            </dl>
            {whatsappNumber && (
              <a
                href={`https://wa.me/${whatsappNumber}?text=${waText}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-8 flex w-fit items-center gap-2.5 border-b border-espresso pb-1 text-[0.95rem] font-medium"
              >
                <WhatsappIcon className="h-5 w-5" /> Sorunuz varsa WhatsApp'tan yazın
              </a>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {step < 4 && (
        <div className="mt-10 flex items-center justify-between gap-4 border-t border-espresso/10 pt-6">
          {step > 1 ? (
            <button type="button" onClick={() => setStep((s) => (s - 1) as Step)} className="inline-flex items-center gap-2 text-[0.92rem] text-taupe hover:text-espresso">
              <ArrowLeft className="h-4 w-4" /> Geri
            </button>
          ) : (
            <span />
          )}
          {step < 3 ? (
            <CtaButton tone="dark" withIcon={false} onClick={goNext}>Devam et</CtaButton>
          ) : (
            <CtaButton tone="dark" withIcon={false} onClick={() => void submit()} disabled={submitting}>
              {submitting ? 'Gönderiliyor…' : 'Talebi gönder'}
            </CtaButton>
          )}
        </div>
      )}
      {step === 1 && site.settings.contact.whatsapp && (
        <p className="mt-6 text-[0.85rem] text-taupe">
          Formu doldurmak yerine{' '}
          <a className="underline decoration-gold underline-offset-4" href={`https://wa.me/${site.settings.contact.whatsapp}?text=${encodeURIComponent('Merhaba, randevu almak istiyorum.')}`} target="_blank" rel="noopener noreferrer">
            WhatsApp'tan da yazabilirsiniz
          </a>
          .
        </p>
      )}
    </div>
  );
}
