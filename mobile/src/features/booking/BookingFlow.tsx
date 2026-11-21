// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Uygulama içi randevu talebi — web'deki BookingForm ile aynı adımlar ve kurallar (src/components/forms/BookingForm.tsx):
 *  1) Görüşme: konu (beslenme görüşmesi / pilates), hizmet ya da ders türü, görüşme tercihi
 *  2) Zaman: müsait gün/saat seçimi ya da "saat seçmeden talep"; pilateste yalnızca tercih edilen günler ve gün içi aralık
 *  3) Bilgiler: ad soyad, telefon, e-posta, mesaj, KVKK
 *  4) Sonuç: talep "onay bekliyor" olarak alınır, referans kodu gösterilir.
 * Uçlar herkese açıktır (POST /api/public/appointments). Sunucu talebi telefon/e-posta ile danışan kaydına bağlar
 * (findClientByContact), bu yüzden ad ve e-posta danışan hesabından doldurulur.
 */
import { formatPhone } from '@/lib/text';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { publicAppointmentRequestSchema } from '@shared/schemas';
import {
  DAYPARTS, DAYPART_HOURS, DAYPART_LABEL, MEETING_TYPE_LABEL, PILATES_FORMAT_LABEL, WEEKDAY_LABEL, pilatesPreferenceText,
  type AppointmentKind, type Daypart, type MeetingType, type PilatesFormat,
} from '@shared/constants';
import { Button, Chips, Icon, Notice, Screen, Segmented, T, TextField } from '@/components/ui';
import { ServiceIcon } from '@/features/services/ServiceIcon';
import { ApiError, api } from '@/lib/api';
import { useClient } from '@/lib/auth';
import { SITE_URL } from '@/lib/config';
import { addDays, formatDayStr, todayStr } from '@/lib/format';
import { queryClient, useApiQuery } from '@/lib/query';
import { colors, fonts, radius, space } from '@/theme';
import { MonthCalendar, monthEnd, monthOf } from './MonthCalendar';
import { CheckRow, FieldTitle, Lead, OptionCard } from './Parts';
import { StepIndicator } from './StepIndicator';
import { BK, type BookingSite, type DaysRes, type SlotsRes, type Step, type SubmitRes } from './types';

const PILATES_FORMAT_NOTE: Record<PilatesFormat, string> = {
  GROUP: 'Küçük gruplarla, aynı seviyedeki kişilerle ders.',
  PRIVATE: 'Yalnızca sana ayrılmış, birebir ders.',
};

const openPage = (path: string) => void WebBrowser.openBrowserAsync(SITE_URL + path);
const openWhatsapp = (number: string, text: string) => void Linking.openURL(`https://wa.me/${number}?text=${encodeURIComponent(text)}`);

export function BookingFlow({ site, initialKind = 'CONSULTATION' }: { site: BookingSite; initialKind?: AppointmentKind }) {
  const me = useClient();
  const cfg = site.settings.appointment;
  const contact = site.settings.contact;
  const meetingOptions = (['IN_PERSON', 'ONLINE'] as MeetingType[]).filter((m) => (m === 'IN_PERSON' ? cfg.inPersonEnabled : cfg.onlineEnabled));

  const [step, setStep] = useState<Step>(1);
  const [kind, setKind] = useState<AppointmentKind>(initialKind);
  const pilates = kind === 'PILATES';
  const [pilatesFormat, setPilatesFormat] = useState<PilatesFormat | null>(null);
  const [prefDays, setPrefDays] = useState<number[]>([]);
  const [prefParts, setPrefParts] = useState<Daypart[]>([]);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [meetingType, setMeetingType] = useState<MeetingType | null>(meetingOptions.length === 1 ? meetingOptions[0]! : null);
  const [mode, setMode] = useState<'slot' | 'callback'>(initialKind === 'PILATES' ? 'callback' : 'slot');
  const today = todayStr();
  const maxDate = addDays(today, cfg.maxDaysAhead);
  const [month, setMonth] = useState(monthOf(today));
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [form, setForm] = useState({
    fullName: `${me.firstName} ${me.lastName}`.trim(),
    phone: formatPhone(me.phone),
    email: me.email ?? '',
    message: '',
    kvkkNotice: false,
    explicitConsent: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitRes | null>(null);

  const service = site.services.find((s) => s.id === serviceId) ?? null;
  const slotStep = step === 2 && !pilates && mode === 'slot';

  // Ay görünümündeki müsait günler
  const from = month > today ? month : today;
  const monthLast = monthEnd(month);
  const to = monthLast < maxDate ? monthLast : maxDate;
  const daysQ = useApiQuery(
    BK.days(from, to, serviceId),
    () => api.get<DaysRes>('/public/availability/days', { from, to, serviceId: serviceId ?? undefined }),
    { enabled: slotStep && from <= to, staleTime: 0 },
  );
  // Tüm aralıkta hiç müsait gün yoksa (takvim kapalı) bunu tespit et
  const allQ = useApiQuery(
    BK.days(today, maxDate, serviceId),
    () => api.get<DaysRes>('/public/availability/days', { from: today, to: maxDate, serviceId: serviceId ?? undefined }),
    { enabled: step === 2 && !pilates, staleTime: 0 },
  );
  const days = useMemo(() => new Map((from <= to ? daysQ.data?.days ?? [] : []).map((d) => [d.date, d.available])), [daysQ.data, from, to]);
  const anyAvailable = daysQ.data?.days.some((d) => d.available > 0) ? true : allQ.data ? allQ.data.days.some((d) => d.available > 0) : null;

  const slotsQ = useApiQuery(
    BK.slots(date ?? '', serviceId),
    () => api.get<SlotsRes>('/public/availability/slots', { date: date!, serviceId: serviceId ?? undefined }),
    { enabled: !!date && !pilates && mode === 'slot' && step >= 2, staleTime: 0 },
  );
  const slots: SlotsRes | undefined = slotsQ.error ? { date: date ?? '', closedReason: 'Saatler şu an yüklenemedi.', slots: [] } : slotsQ.data;
  const freeSlots = slots?.slots.filter((s) => s.available) ?? [];

  // Saat artık boş değilse (yenilenen liste) seçimi kaldır
  useEffect(() => {
    if (time && slotsQ.data && !slotsQ.data.slots.some((s) => s.available && s.time === time)) setTime(null);
  }, [slotsQ.data, time]);

  const pickDate = (d: string) => {
    setDate(d);
    setTime(null);
    setNotice(null);
  };

  const goNext = () => {
    setNotice(null);
    if (step === 1) {
      if (pilates) {
        if (!pilatesFormat) return setErrors({ pilatesFormat: 'Grup dersi mi birebir ders mi istediğini seç' });
      } else if (!meetingType) {
        return setErrors({ meetingType: 'Görüşme tercihini seç' });
      }
      setErrors({});
      setStep(2);
    } else if (step === 2) {
      if (!pilates && mode === 'slot' && (!date || !time)) return setErrors({ time: 'Lütfen bir gün ve saat seç' });
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
      website: '',
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
      // Hesabım: yanıt bekleyen talepler, randevular, özet
      void queryClient.invalidateQueries({ queryKey: ['portal'] });
      void queryClient.invalidateQueries({ queryKey: BK.availability });
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 422 && Object.keys(e.fields).length) setErrors(e.fields);
        else if (e.status === 409) {
          // SLOT_TAKEN, TOO_SOON, DUPLICATE_REQUEST … — sunucunun mesajı; saatler yenilenir
          setNotice(e.message);
          setStep(2);
          setTime(null);
          void queryClient.invalidateQueries({ queryKey: BK.availability });
        } else setNotice(e.message);
      } else setNotice('Talebin gönderilemedi. Lütfen tekrar dene.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedLabel = date ? formatDayStr(date, 'd MMMM cccc') : null;
  const whatsappNumber = result?.whatsapp ?? contact.whatsapp;

  const footer =
    step < 4 ? (
      <View style={styles.footer}>
        {step > 1 ? <Button title="Geri" variant="secondary" icon="arrow-left" onPress={() => { setNotice(null); setErrors({}); setStep((s) => (s - 1) as Step); }} style={{ flex: 1 }} /> : null}
        {step < 3 ? (
          <Button title="Devam et" onPress={goNext} style={{ flex: 2 }} />
        ) : (
          <Button title={submitting ? 'Gönderiliyor…' : 'Talebi gönder'} loading={submitting} onPress={() => void submit()} style={{ flex: 2 }} />
        )}
      </View>
    ) : (
      <Button title="Randevularıma dön" onPress={() => router.replace('/hesabim/randevular')} full />
    );

  return (
    <Screen footer={footer}>
      {step < 4 ? <StepIndicator step={step} /> : null}
      {notice ? <View style={{ marginBottom: space.lg }}><Notice tone="danger" text={notice} /></View> : null}

      {step === 1 ? (
        <View style={styles.stack}>
          <T variant="title">Sana nasıl yardımcı olabilirim?</T>
          <Segmented
            value={kind}
            options={[{ value: 'CONSULTATION', label: 'Beslenme danışmanlığı' }, { value: 'PILATES', label: 'Pilates dersi' }]}
            onChange={(k) => {
              setKind(k);
              setMode(k === 'PILATES' ? 'callback' : 'slot');
              setErrors({});
            }}
          />
          {pilates ? (
            <View style={{ gap: space.sm }}>
              <T muted>Grup dersine mi katılmak istersin, birebir ders mi?</T>
              {(['GROUP', 'PRIVATE'] as const).map((f) => (
                <OptionCard
                  key={f}
                  title={PILATES_FORMAT_LABEL[f]}
                  description={PILATES_FORMAT_NOTE[f]}
                  selected={pilatesFormat === f}
                  onPress={() => {
                    setPilatesFormat(f);
                    setErrors({});
                  }}
                />
              ))}
              {errors.pilatesFormat ? <T variant="caption" color={colors.dangerInk}>{errors.pilatesFormat}</T> : null}
              {contact.venueName ? (
                <T variant="caption">
                  Dersler {contact.venueName}’da yapılır{contact.district ? ` (${contact.district})` : ''}.
                </T>
              ) : null}
            </View>
          ) : (
            <>
              <View style={{ gap: space.sm }}>
                <T muted>Bir hizmet seçebilir ya da bu adımı boş bırakabilirsin; ilk görüşmede birlikte netleştiririz.</T>
                {[{ id: null as string | null, title: 'Henüz karar vermedim', icon: 'sprout' }, ...site.services.map((s) => ({ id: s.id as string | null, title: s.title, icon: s.icon as string }))].map((s) => {
                  const active = serviceId === s.id;
                  return (
                    <OptionCard
                      key={s.id ?? 'none'}
                      title={s.title}
                      selected={active}
                      onPress={() => setServiceId(s.id)}
                      icon={<ServiceIcon name={s.icon} size={22} color={active ? colors.rose : colors.goldInk} />}
                    />
                  );
                })}
              </View>
              <View>
                <FieldTitle>Görüşme tercihi</FieldTitle>
                <View style={{ gap: space.sm }}>
                  {meetingOptions.map((m) => (
                    <OptionCard
                      key={m}
                      title={MEETING_TYPE_LABEL[m]}
                      selected={meetingType === m}
                      onPress={() => {
                        setMeetingType(m);
                        setErrors({});
                      }}
                    />
                  ))}
                </View>
                {errors.meetingType ? <T variant="caption" color={colors.dangerInk} style={{ marginTop: space.xs }}>{errors.meetingType}</T> : null}
                {meetingType === 'IN_PERSON' && contact.venueName ? (
                  <T variant="caption" style={{ marginTop: space.sm }}>
                    Yüz yüze görüşmeler {contact.venueName}’in üst katındaki danışmanlık alanında yapılır{contact.district ? ` (${contact.district})` : ''}.
                  </T>
                ) : null}
              </View>
            </>
          )}
          {contact.whatsapp ? (
            <T variant="caption">
              Formu doldurmak yerine{' '}
              <T variant="caption" color={colors.text} style={styles.link} onPress={() => openWhatsapp(contact.whatsapp!, 'Merhaba, randevu almak istiyorum.')} accessibilityRole="link">
                WhatsApp'tan da yazabilirsin
              </T>
              .
            </T>
          ) : null}
        </View>
      ) : null}

      {step === 2 && pilates ? (
        <View style={styles.stack}>
          <T variant="title">Hangi zamanlar sana uyar?</T>
          <T muted>
            Ders saati, {pilatesFormat === 'GROUP' ? 'grupların doluluğuna' : 'takvime'} göre seninle birlikte belirlenir. Boş bırakırsan “fark etmez” olarak iletilir.
          </T>
          <Chips
            label="Günler"
            multiple
            value={prefDays}
            options={[1, 2, 3, 4, 5, 6, 7].map((d) => ({ value: d, label: WEEKDAY_LABEL[d]! }))}
            onChange={(v) => setPrefDays(v as number[])}
          />
          <View style={{ gap: space.sm }}>
            <FieldTitle>Gün içinde</FieldTitle>
            {DAYPARTS.map((p) => {
              const sel = prefParts.includes(p);
              return (
                <OptionCard
                  key={p}
                  role="checkbox"
                  title={DAYPART_LABEL[p]}
                  description={DAYPART_HOURS[p]}
                  selected={sel}
                  onPress={() => setPrefParts((l) => (sel ? l.filter((x) => x !== p) : [...l, p]))}
                />
              );
            })}
          </View>
        </View>
      ) : null}

      {step === 2 && !pilates ? (
        <View style={styles.stack}>
          <T variant="title">Sana uygun zamanı seç</T>
          {cfg.allowRequestWithoutTime ? (
            <Segmented
              value={mode}
              options={[{ value: 'slot', label: 'Gün ve saat seç' }, { value: 'callback', label: 'Saat seçmeden talep bırak' }]}
              onChange={(m) => {
                setMode(m);
                setErrors({});
              }}
            />
          ) : null}

          {mode === 'callback' ? (
            <Lead icon="phone-call">
              <T variant="heading">Senin için uygun bir zamanı birlikte planlayalım.</T>
              <T muted>Bilgilerini bırak; talebin incelendikten sonra seninle iletişime geçilerek görüşme zamanı belirlenir.</T>
            </Lead>
          ) : daysQ.isError ? (
            <View style={{ gap: space.xs }}>
              <T variant="heading">Takvim şu an yüklenemedi.</T>
              <T muted>Lütfen biraz sonra tekrar dene{cfg.allowRequestWithoutTime ? ' ya da saat seçmeden talep bırak' : ''}.</T>
              <Button title="Tekrar dene" variant="secondary" size="sm" onPress={() => void daysQ.refetch()} style={{ alignSelf: 'flex-start', marginTop: space.sm }} />
            </View>
          ) : anyAvailable === false ? (
            <View style={{ gap: space.xs }}>
              <T variant="heading">Çevrim içi takvimde şu an açık saat bulunmuyor.</T>
              <T muted>
                Uygun saatler yakında yayınlanacak.{cfg.allowRequestWithoutTime ? ' Dilersen şimdi bilgilerini bırak; senin için uygun zaman birlikte planlansın.' : ''}
              </T>
              {cfg.allowRequestWithoutTime ? (
                <Button title="Saat seçmeden talep bırak" variant="secondary" size="sm" onPress={() => setMode('callback')} style={{ alignSelf: 'flex-start', marginTop: space.sm }} />
              ) : null}
            </View>
          ) : (
            <>
              <MonthCalendar
                month={month}
                onMonth={setMonth}
                days={days}
                selected={date}
                onSelect={pickDate}
                minDate={today}
                maxDate={maxDate}
                loading={daysQ.isFetching}
              />
              <View style={styles.slots}>
                {!date ? (
                  <T muted>Noktayla işaretli günlerden birini seçtiğinde uygun saatler burada görünür.</T>
                ) : (
                  <>
                    <T variant="overline">{selectedLabel}</T>
                    {slotsQ.isFetching && !slots ? (
                      <T muted>Saatler yükleniyor…</T>
                    ) : freeSlots.length ? (
                      <View style={styles.slotGrid} accessibilityRole="radiogroup" accessibilityLabel="Saat seç">
                        {freeSlots.map((s) => {
                          const sel = time === s.time;
                          return (
                            <View key={s.time} style={styles.slotCell}>
                              <Pressable
                                onPress={() => {
                                  setTime(s.time);
                                  setErrors({});
                                }}
                                accessibilityRole="radio"
                                accessibilityState={{ checked: sel }}
                                accessibilityLabel={`${s.time}–${s.endTime}`}
                                style={[styles.slot, sel && styles.slotSel]}
                              >
                                <T style={[styles.slotText, sel && { color: colors.cream }]}>{s.time}</T>
                              </Pressable>
                            </View>
                          );
                        })}
                      </View>
                    ) : (
                      <T muted>{slots?.closedReason ?? 'Bu gün için uygun saat kalmadı.'}</T>
                    )}
                  </>
                )}
                {errors.time ? <T variant="caption" color={colors.dangerInk}>{errors.time}</T> : null}
              </View>
            </>
          )}
        </View>
      ) : null}

      {step === 3 ? (
        <View style={styles.stack}>
          <View style={{ gap: space.xs }}>
            <T variant="title">Seni nasıl tanıyalım?</T>
            <T variant="caption">
              {pilates
                ? `Pilates · ${pilatesFormat ? PILATES_FORMAT_LABEL[pilatesFormat] : ''} · ${pilatesPreferenceText(prefDays, prefParts)}`
                : `${MEETING_TYPE_LABEL[meetingType ?? 'IN_PERSON']}${service ? ` · ${service.title}` : ''}${mode === 'slot' && selectedLabel ? ` · ${selectedLabel}, ${time}` : ' · Zaman birlikte planlanacak'}`}
            </T>
          </View>
          <TextField label="Ad Soyad" required value={form.fullName} onChange={(v) => setForm({ ...form, fullName: v })} error={errors.fullName} autoComplete="name" textContentType="name" placeholder="Adın ve soyadın" />
          <TextField
            label="Telefon"
            required
            value={form.phone}
            onChange={(v) => setForm({ ...form, phone: v })}
            error={errors.phone}
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            placeholder="05xx xxx xx xx"
            help={me.phone ? 'Danışan kaydındaki numaran; değiştirirsen talep yine e-postanla hesabına bağlanır.' : 'Danışan kaydındaki numaranı yazarsan talebin hesabına bağlanır.'}
          />
          <TextField label="E-posta" required value={form.email} onChange={(v) => setForm({ ...form, email: v })} error={errors.email} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" placeholder="ornek@eposta.com" />
          <TextField
            label="Mesajın (isteğe bağlı)"
            value={form.message}
            onChange={(v) => setForm({ ...form, message: v })}
            error={errors.message}
            help="Lütfen bu alanda sağlık durumuna ilişkin ayrıntı paylaşma; bu bilgiler görüşmede konuşulur."
            rows={3}
            maxLength={1000}
            placeholder={pilates ? 'Ör. daha önce pilates yaptın mı, hangi seviyedesin?' : 'Görüşme öncesi iletmek istediklerin'}
          />
          <View style={styles.consents}>
            <CheckRow
              label="Aydınlatma Metni'ni okudum"
              checked={form.kvkkNotice}
              onChange={(v) => setForm({ ...form, kvkkNotice: v })}
              error={errors.kvkkNotice}
            >
              <T>
                Kişisel verilerimin işlenmesine ilişkin{' '}
                <T style={styles.link} onPress={() => openPage('/kvkk-aydinlatma-metni')} accessibilityRole="link">Aydınlatma Metni</T>'ni okudum.
                <T color={colors.roseInk}> *</T>
              </T>
            </CheckRow>
            <CheckRow label="Açık rıza (isteğe bağlı)" checked={form.explicitConsent} onChange={(v) => setForm({ ...form, explicitConsent: v })}>
              <T muted>
                (İsteğe bağlı) Mesajımda paylaştığım bilgilerin randevu talebimin değerlendirilmesi amacıyla işlenmesine{' '}
                <T style={styles.link} onPress={() => openPage('/acik-riza-metni')} accessibilityRole="link">Açık Rıza Metni</T> kapsamında onay veriyorum.
              </T>
            </CheckRow>
          </View>
          {cfg.formNote ? <T variant="caption">{cfg.formNote}</T> : null}
        </View>
      ) : null}

      {step === 4 && result ? (
        <View style={styles.stack}>
          <View style={styles.doneIcon}>
            <Icon name="check" size={26} color={colors.goldInk} />
          </View>
          <View style={{ gap: space.xs }}>
            <T variant="display">Talebin alındı.</T>
            <T variant="overline" color={colors.roseInk}>Durum: Onay bekliyor</T>
          </View>
          <T color={colors.cocoa}>
            {pilates
              ? `Pilates talebin (${pilatesFormat ? PILATES_FORMAT_LABEL[pilatesFormat].toLocaleLowerCase('tr') : 'ders'}) bize ulaştı. ${pilatesFormat === 'GROUP' ? 'Sana uygun bir grup' : 'Uygun bir ders saati'} belirlendiğinde seninle iletişime geçilecek.`
              : result.status === 'NEW_REQUEST'
                ? 'İletişim talebin bize ulaştı. Talebin incelendikten sonra seninle iletişime geçilerek görüşme zamanı birlikte belirlenecek.'
                : `${selectedLabel}, ${time} için talebin bize ulaştı. Bu henüz kesinleşmiş bir randevu değildir; uygunluk kontrolünden sonra seninle iletişime geçilecek.`}
          </T>
          <View style={styles.reference}>
            <T variant="overline" color={colors.muted}>Referans kodu</T>
            <T style={{ fontFamily: fonts.display, fontSize: 28, lineHeight: 32, letterSpacing: 1.5 }} selectable>{result.reference}</T>
          </View>
          {whatsappNumber ? (
            <Button
              title="Sorun varsa WhatsApp'tan yaz"
              variant="secondary"
              icon="message-circle"
              onPress={() => openWhatsapp(whatsappNumber, `Merhaba, uygulamadan ${pilates ? 'pilates' : 'randevu'} talebi oluşturdum (Referans: ${result.reference}).`)}
              style={{ alignSelf: 'flex-start' }}
            />
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.xl },
  footer: { flexDirection: 'row', gap: space.sm },
  link: { textDecorationLine: 'underline', textDecorationColor: colors.gold, color: colors.text },
  slots: { gap: space.md, paddingTop: space.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -space.xs / 2 },
  slotCell: { width: '25%', padding: space.xs / 2 },
  slot: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  slotSel: { backgroundColor: colors.espresso, borderColor: colors.espresso },
  slotText: { fontFamily: fonts.medium, fontSize: 15, fontVariant: ['tabular-nums'], color: colors.text },
  consents: { gap: space.md, paddingTop: space.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  doneIcon: { width: 56, height: 56, borderRadius: 28, borderWidth: 1, borderColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  reference: { alignSelf: 'flex-start', gap: 2, paddingVertical: space.md, paddingRight: space.xxl, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
});
