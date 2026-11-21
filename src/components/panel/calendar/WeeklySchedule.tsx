// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Haftalık çalışma saatleri düzenleyici */
import { useEffect, useMemo, useState } from 'react';
import { CalendarCog, Copy } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Button, Card, CardHeader, ErrorState, Skeleton, Switch, useFeedback } from '@/components/panel/ui';
import { WEEKDAY_LABEL } from '@shared/constants';
import { cn } from '@/lib/format';
import { SaveBar } from '@/components/panel/content/FormBits';
import { slotsPerDay, type AffectedAppointment, type Rule } from './types';

const ctl = 'h-9 w-full rounded-lg border border-panel-line bg-white px-2 text-sm tabular text-espresso focus:border-cocoa focus:ring-2 focus:ring-cocoa/10 focus:outline-none disabled:bg-panel-bg disabled:text-panel-muted/60 aria-[invalid=true]:border-danger';

function TimeField({ label, value, onChange, disabled, invalid }: { label: string; value: string | null; onChange: (v: string | null) => void; disabled?: boolean; invalid?: boolean }) {
  return (
    <input type="time" step={300} aria-label={label} title={label} className={ctl} value={value ?? ''} disabled={disabled} aria-invalid={invalid} onChange={(e) => onChange(e.target.value || null)} />
  );
}

function NumField({ label, value, onChange, disabled, min, max, invalid }: { label: string; value: number; onChange: (v: number) => void; disabled?: boolean; min: number; max: number; invalid?: boolean }) {
  return (
    <div className="relative">
      <input
        type="number"
        aria-label={label}
        title={label}
        inputMode="numeric"
        min={min}
        max={max}
        step={5}
        className={cn(ctl, 'pr-8')}
        value={Number.isFinite(value) ? value : ''}
        disabled={disabled}
        aria-invalid={invalid}
        onChange={(e) => onChange(e.target.value === '' ? NaN : Number(e.target.value))}
      />
      <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-[0.72rem] text-panel-muted">dk</span>
    </div>
  );
}

export function WeeklySchedule({ onWarnings, onSaved }: { onWarnings: (w: AffectedAppointment[]) => void; onSaved?: (rules: Rule[]) => void }) {
  const fb = useFeedback();
  const [saved, setSaved] = useState<Rule[] | null>(null);
  const [rules, setRules] = useState<Rule[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setError(null);
    try {
      const res = await api.get<{ rules: Rule[] }>('/availability/rules');
      const clean = res.rules.map(({ weekday, isWorking, startTime, endTime, breakStart, breakEnd, slotMinutes, bufferMinutes }) => ({ weekday, isWorking, startTime, endTime, breakStart, breakEnd, slotMinutes, bufferMinutes }));
      setSaved(clean);
      setRules(clean);
      onSaved?.(clean);
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError(0, 'ERR', 'Yüklenemedi'));
    }
  };
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dirty = useMemo(() => JSON.stringify(rules) !== JSON.stringify(saved), [rules, saved]);
  useEffect(() => {
    if (!dirty) return;
    const on = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', on);
    return () => window.removeEventListener('beforeunload', on);
  }, [dirty]);

  if (error) return <Card><ErrorState message={error.message} onRetry={() => void load()} /></Card>;
  if (!rules) return <Skeleton className="h-[30rem] w-full rounded-xl" />;

  const update = (i: number, patch: Partial<Rule>) => {
    setRules((rs) => rs!.map((r, j) => (j === i ? { ...r, ...patch } : r)));
    setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !k.startsWith(`rules.${i}.`))));
  };
  const err = (i: number, f: string) => errors[`rules.${i}.${f}`];
  const rowErrors = (i: number) => Object.entries(errors).filter(([k]) => k.startsWith(`rules.${i}.`)).map(([, v]) => v);

  const copyMonday = () => {
    const mon = rules[0];
    setRules(rules.map((r) => (r.weekday >= 2 && r.weekday <= 5 ? { ...mon, weekday: r.weekday } : r)));
    fb.toast({ tone: 'info', title: 'Pazartesi ayarları Salı–Cuma günlerine kopyalandı', description: 'Kaydetmeyi unutmayın.' });
  };

  const save = async () => {
    // İstemci tarafı ön kontrol: çalışılan günde saatler boş olamaz
    const local: Record<string, string> = {};
    rules.forEach((r, i) => {
      if (r.isWorking && (!r.startTime || !r.endTime)) local[`rules.${i}.startTime`] = 'Çalışılan gün için başlangıç ve bitiş saati girin';
      if (!Number.isFinite(r.slotMinutes) || r.slotMinutes < 10 || r.slotMinutes > 240) local[`rules.${i}.slotMinutes`] = 'Randevu süresi 10–240 dk olmalı';
      if (!Number.isFinite(r.bufferMinutes) || r.bufferMinutes < 0 || r.bufferMinutes > 120) local[`rules.${i}.bufferMinutes`] = 'Dinlenme süresi 0–120 dk olmalı';
    });
    if (Object.keys(local).length) {
      setErrors(local);
      fb.error('Kaydedilemedi', 'İşaretli günleri kontrol edin.');
      return;
    }
    setSaving(true);
    try {
      const res = await api.put<{ rules: Rule[]; warnings: AffectedAppointment[] }>('/availability/rules', { rules });
      const clean = res.rules.map(({ weekday, isWorking, startTime, endTime, breakStart, breakEnd, slotMinutes, bufferMinutes }) => ({ weekday, isWorking, startTime, endTime, breakStart, breakEnd, slotMinutes, bufferMinutes }));
      setSaved(clean);
      setRules(clean);
      setErrors({});
      onSaved?.(clean);
      onWarnings(res.warnings);
      fb.success('Çalışma saatleri kaydedildi', 'Web sitesindeki randevu saatleri güncellendi.');
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        setErrors(e.fields);
        fb.error('Kaydedilemedi', 'İşaretli günleri kontrol edin.');
      } else fb.error('Kaydedilemedi', e instanceof ApiError ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const weeklyTotal = rules.reduce((n, r) => n + slotsPerDay(r), 0);
  const noneWorking = !rules.some((r) => r.isWorking);

  return (
    <Card>
      <CardHeader
        title="Haftalık çalışma saatleri"
        description="Web sitesindeki randevu formu yalnızca bu saatlerdeki boş zaman dilimlerini gösterir."
        action={
          <Button variant="secondary" size="sm" icon={<Copy className="h-4 w-4" />} onClick={copyMonday} disabled={!rules[0].isWorking}>
            Pazartesi’yi hafta içine kopyala
          </Button>
        }
      />
      {noneWorking && (
        <div className="mx-5 mt-4 flex items-start gap-3 rounded-lg border border-rose/50 bg-rose/15 p-4 text-[0.85rem] text-[#6f4336]">
          <CalendarCog className="mt-0.5 h-5 w-5 shrink-0" />
          <p>
            <strong>Çalışma saatleri henüz tanımlanmadı.</strong> Web sitesindeki randevu formu yalnızca “beni arayın” talebi alır. Çalıştığınız günleri açıp saatlerinizi girin.
          </p>
        </div>
      )}
      <div className="mt-4 hidden grid-cols-[8.5rem_4.5rem_minmax(0,1fr)_minmax(0,1fr)_6.5rem_6.5rem_7.5rem] gap-3 border-y border-panel-line bg-panel-bg/50 px-5 py-2.5 text-[0.7rem] font-semibold tracking-wide text-panel-muted uppercase xl:grid">
        <span>Gün</span>
        <span>Açık</span>
        <span>Çalışma saatleri</span>
        <span>Öğle arası (isteğe bağlı)</span>
        <span>Randevu süresi</span>
        <span>Ara dinlenme</span>
        <span className="text-right">Kapasite</span>
      </div>
      <ul className="divide-y divide-panel-line border-t border-panel-line xl:border-t-0">
        {rules.map((r, i) => {
          const off = !r.isWorking;
          const n = slotsPerDay(r);
          const rowErr = rowErrors(i);
          return (
            <li key={r.weekday} className={cn('px-5 py-4', off && 'bg-panel-bg/40')}>
              <div className="grid grid-cols-2 items-center gap-3 sm:grid-cols-4 xl:grid-cols-[8.5rem_4.5rem_minmax(0,1fr)_minmax(0,1fr)_6.5rem_6.5rem_7.5rem]">
                <p className={cn('font-semibold', off ? 'text-panel-muted' : 'text-espresso')}>{WEEKDAY_LABEL[r.weekday]}</p>
                <div className="justify-self-end xl:justify-self-start sm:col-span-3 xl:col-span-1">
                  <Switch checked={r.isWorking} onChange={(v) => update(i, { isWorking: v })} label={<span className="sr-only">{WEEKDAY_LABEL[r.weekday]} çalışıyor</span>} />
                </div>
                <div className="col-span-2 flex items-center gap-1.5 sm:col-span-2 xl:col-span-1">
                  <span className="w-14 shrink-0 text-[0.72rem] text-panel-muted xl:hidden">Saatler</span>
                  <TimeField label={`${WEEKDAY_LABEL[r.weekday]} başlangıç`} value={r.startTime} disabled={off} invalid={!!err(i, 'startTime')} onChange={(v) => update(i, { startTime: v })} />
                  <span className="text-panel-muted">–</span>
                  <TimeField label={`${WEEKDAY_LABEL[r.weekday]} bitiş`} value={r.endTime} disabled={off} invalid={!!err(i, 'endTime')} onChange={(v) => update(i, { endTime: v })} />
                </div>
                <div className="col-span-2 flex items-center gap-1.5 sm:col-span-2 xl:col-span-1">
                  <span className="w-14 shrink-0 text-[0.72rem] text-panel-muted xl:hidden">Öğle arası</span>
                  <TimeField label={`${WEEKDAY_LABEL[r.weekday]} öğle arası başlangıç`} value={r.breakStart} disabled={off} invalid={!!err(i, 'breakStart')} onChange={(v) => update(i, { breakStart: v })} />
                  <span className="text-panel-muted">–</span>
                  <TimeField label={`${WEEKDAY_LABEL[r.weekday]} öğle arası bitiş`} value={r.breakEnd} disabled={off} invalid={!!err(i, 'breakEnd')} onChange={(v) => update(i, { breakEnd: v })} />
                </div>
                <label className="flex items-center gap-1.5 sm:col-span-2 xl:col-span-1">
                  <span className="w-14 shrink-0 text-[0.72rem] text-panel-muted xl:hidden">Süre</span>
                  <NumField label={`${WEEKDAY_LABEL[r.weekday]} randevu süresi`} min={10} max={240} value={r.slotMinutes} disabled={off} invalid={!!err(i, 'slotMinutes')} onChange={(v) => update(i, { slotMinutes: v })} />
                </label>
                <label className="flex items-center gap-1.5 sm:col-span-2 xl:col-span-1">
                  <span className="w-14 shrink-0 text-[0.72rem] text-panel-muted xl:hidden">Dinlenme</span>
                  <NumField label={`${WEEKDAY_LABEL[r.weekday]} randevular arası dinlenme`} min={0} max={120} value={r.bufferMinutes} disabled={off} invalid={!!err(i, 'bufferMinutes')} onChange={(v) => update(i, { bufferMinutes: v })} />
                </label>
                <p className="col-span-2 text-[0.8rem] text-panel-muted sm:col-span-4 xl:col-span-1 xl:text-right">
                  {off ? 'Kapalı' : n > 0 ? <span><span className="tabular font-semibold text-espresso">{n}</span> randevu / gün</span> : 'Saatleri girin'}
                </p>
              </div>
              {rowErr.length > 0 && (
                <p className="mt-2 text-[0.78rem] text-danger-ink" role="alert">{[...new Set(rowErr)].join(' · ')}</p>
              )}
            </li>
          );
        })}
      </ul>
      <SaveBar
        dirty={dirty}
        saving={saving}
        onSave={() => void save()}
        onReset={() => (setRules(saved), setErrors({}))}
        note={weeklyTotal > 0 ? <span>Bu ayarlarla haftada en fazla <strong className="tabular text-espresso">{weeklyTotal}</strong> randevu alınabilir.</span> : 'Tüm değişiklikler kaydedildi'}
      />
    </Card>
  );
}
