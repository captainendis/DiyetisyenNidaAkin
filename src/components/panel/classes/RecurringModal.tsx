// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Gruba haftalık ders programı ekler: gün + saat seçimi, başlangıç, hafta sayısı. Uygun olmayan tarihler atlanır ve listelenir. */
import { useEffect, useState } from 'react';
import { CalendarCheck2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { cn, formatDayStr, todayStr } from '@/lib/format';
import { WEEKDAY_LABEL } from '@shared/constants';
import { Button, Input, Modal, Switch, useFeedback } from '@/components/panel/ui';
import type { ClassGroupDTO, ClassRecurringResult } from './shared';

const DAYS = [1, 2, 3, 4, 5, 6, 7];

export function RecurringModal({ open, group, onClose, onDone }: { open: boolean; group: ClassGroupDTO | null; onClose: () => void; onDone: () => void }) {
  const fb = useFeedback();
  const [times, setTimes] = useState<Record<number, string>>({});
  const [startDate, setStartDate] = useState(todayStr());
  const [weeks, setWeeks] = useState('8');
  const [duration, setDuration] = useState('');
  const [outside, setOutside] = useState(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ClassRecurringResult | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !group) return;
    // Mevcut düzen varsa onu öner
    setTimes(Object.fromEntries(group.pattern.map((p) => [p.weekday, p.time])));
    setStartDate(todayStr());
    setWeeks('8');
    setDuration(String(group.defaultDurationMinutes));
    setOutside(false);
    setResult(null);
    setError('');
  }, [open, group]);

  const toggle = (d: number) =>
    setTimes((t) => {
      const next = { ...t };
      if (d in next) delete next[d];
      else next[d] = Object.values(t)[0] ?? '18:00';
      return next;
    });

  const slots = Object.entries(times).map(([weekday, time]) => ({ weekday: Number(weekday), time }));
  const estimate = slots.length * (Number(weeks) || 0);

  const submit = async () => {
    if (!group) return;
    if (!slots.length) return setError('En az bir gün seçin');
    if (slots.some((s) => !/^\d{2}:\d{2}$/.test(s.time))) return setError('Her gün için saat girin');
    setError('');
    setPending(true);
    try {
      const r = await api.post<ClassRecurringResult>(`/classes/groups/${group.id}/recurring`, {
        slots,
        startDate,
        weeks: Number(weeks),
        durationMinutes: Number(duration) || undefined,
        allowOutsideHours: outside,
      });
      setResult(r);
      if (r.created) fb.success(`${r.created} ders eklendi`, group.name);
      onDone();
    } catch (e) {
      if (e instanceof ApiError) {
        setError(Object.values(e.fields)[0] ?? e.message);
        fb.error('Ders programı eklenemedi', e.message);
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
      title="Ders programı ekle"
      description={group ? `${group.name} · ${group.members.length}/${group.capacity} üye derslere otomatik eklenir` : undefined}
      footer={
        result ? (
          <Button onClick={onClose}>Tamam</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>Vazgeç</Button>
            <Button onClick={submit} loading={pending} disabled={!slots.length}>{estimate ? `${estimate} ders oluştur` : 'Dersleri oluştur'}</Button>
          </>
        )
      }
    >
      {result ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg bg-success/10 px-4 py-3 text-success-ink">
            <CalendarCheck2 className="h-5 w-5 shrink-0" />
            <p className="text-sm font-semibold"><span className="tabular">{result.created}</span> ders takvime eklendi.</p>
          </div>
          {result.skipped.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold text-espresso">Atlanan tarihler <span className="tabular font-normal text-panel-muted">({result.skipped.length})</span></p>
              <ul className="divide-y divide-panel-line rounded-lg border border-panel-line text-sm">
                {result.skipped.map((s) => (
                  <li key={`${s.date}${s.time}`} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-3.5 py-2">
                    <span className="tabular font-semibold text-espresso">{formatDayStr(s.date, 'd MMMM cccc')} {s.time}</span>
                    <span className="text-[0.8rem] text-panel-muted">{s.reason}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[0.8rem] text-panel-muted">Bu tarihler için “Tek ders” ile farklı bir saat seçebilirsiniz.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          <fieldset>
            <legend className="mb-2 text-[0.8rem] font-semibold text-cocoa">Günler ve saatler</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {DAYS.map((d) => {
                const on = d in times;
                return (
                  <div key={d} className={cn('flex items-center justify-between gap-3 rounded-lg px-3 py-2 ring-1 ring-inset', on ? 'bg-panel-bg ring-cocoa/40' : 'ring-panel-line')}>
                    <label className="flex flex-1 cursor-pointer items-center gap-2.5 text-sm font-semibold text-espresso">
                      <input type="checkbox" checked={on} onChange={() => toggle(d)} className="h-4 w-4 accent-cocoa" />
                      {WEEKDAY_LABEL[d]}
                    </label>
                    {on && (
                      <input
                        type="time"
                        step={300}
                        value={times[d]}
                        onChange={(e) => setTimes((t) => ({ ...t, [d]: e.target.value }))}
                        aria-label={`${WEEKDAY_LABEL[d]} saati`}
                        className="h-8 rounded-md border border-panel-line bg-white px-2 text-sm tabular focus:border-cocoa focus:outline-none"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-3">
            <Input label="Başlangıç" type="date" min={todayStr()} value={startDate} onChange={(e) => setStartDate(e.target.value)} className="tabular" />
            <Input label="Kaç hafta" type="number" min={1} max={26} value={weeks} onChange={(e) => setWeeks(e.target.value)} hint="En fazla 26 hafta" className="tabular" />
            <Input label="Süre (dk)" type="number" min={15} max={240} step={5} value={duration} onChange={(e) => setDuration(e.target.value)} className="tabular" />
          </div>
          <Switch
            checked={outside}
            onChange={setOutside}
            label="Çalışma saatleri dışında olabilir"
            description="Pilates saatleri danışmanlık saatlerinden farklıysa açın. Randevu ve diğer derslerle çakışma yine kontrol edilir."
          />
          {error && <p className="text-[0.82rem] text-danger-ink" role="alert">{error}</p>}
          <p className="text-[0.8rem] text-panel-muted">Dolu ya da kapalı günlere denk gelen dersler atlanır ve size listelenir; diğerleri oluşturulur.</p>
        </div>
      )}
    </Modal>
  );
}
