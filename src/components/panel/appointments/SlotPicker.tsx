/** Seçilen gün için boş/dolu zaman dilimleri (panel). Çalışma saatleri dışı modda serbest saat girişi. */
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/format';
import type { SlotDTO } from './types';

export function SlotPicker({
  date, duration, ignoreId, value, onChange, freeTime = false,
}: { date: string; duration?: number; ignoreId?: string; value: string; onChange: (t: string) => void; freeTime?: boolean }) {
  const [slots, setSlots] = useState<SlotDTO[] | null>(null);
  const [closed, setClosed] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!date || freeTime) return;
    let live = true;
    setSlots(null);
    setError(false);
    api
      .get<{ closedReason: string | null; slots: SlotDTO[] }>('/appointments/slots', { date, duration, ignoreId })
      .then((r) => {
        if (!live) return;
        setSlots(r.slots);
        setClosed(r.closedReason);
      })
      .catch(() => live && setError(true));
    return () => {
      live = false;
    };
  }, [date, duration, ignoreId, freeTime]);

  if (freeTime) {
    return (
      <div className="flex flex-col gap-1.5">
        <label className="text-[0.8rem] font-semibold text-cocoa" htmlFor="free-time">Saat</label>
        <input id="free-time" type="time" step={300} value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-40 rounded-lg border border-panel-line bg-white px-3 text-sm tabular focus:border-cocoa focus:outline-none" />
        <p className="text-[0.78rem] text-panel-muted">Çalışma saatleri dışı özel randevu — çakışma kontrolü yine yapılır.</p>
      </div>
    );
  }
  if (!date) return <p className="text-sm text-panel-muted">Önce bir gün seçin.</p>;
  if (error) return <p className="text-sm text-danger">Saatler yüklenemedi.</p>;
  if (!slots) {
    return (
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6" aria-busy="true">
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-9 animate-pulse rounded-lg bg-panel-line/60" />)}
      </div>
    );
  }
  if (!slots.length) {
    return (
      <p className="rounded-lg bg-panel-bg px-3 py-2.5 text-sm text-cocoa">
        {closed ?? 'Bu gün için uygun saat yok.'} <span className="text-panel-muted">Çalışma takvimini “Ayarlar → Çalışma Takvimi”nden düzenleyebilir veya özel randevu oluşturabilirsiniz.</span>
      </p>
    );
  }
  return (
    <div role="radiogroup" aria-label="Saat seçin" className="grid grid-cols-4 gap-2 sm:grid-cols-6">
      {slots.map((s) => (
        <button
          key={s.time}
          type="button"
          role="radio"
          aria-checked={value === s.time}
          disabled={!s.available}
          onClick={() => onChange(s.time)}
          title={s.available ? `${s.time}–${s.endTime}` : 'Dolu'}
          className={cn(
            'h-9 rounded-lg text-sm font-semibold tabular ring-1 ring-inset transition-colors',
            value === s.time ? 'bg-cocoa text-ivory ring-cocoa' : s.available ? 'bg-white text-cocoa ring-panel-line hover:ring-cocoa' : 'cursor-not-allowed bg-panel-bg text-panel-muted/60 line-through ring-transparent',
          )}
        >
          {s.time}
        </button>
      ))}
    </div>
  );
}
