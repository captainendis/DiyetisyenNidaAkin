// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Takvim görünümleri
 *  - TimeGrid: gün/hafta. Çalışma dışı saatler taranmış, randevular duruma göre renkli bloklar.
 *    Boş alana tıklama → yeni randevu; bloğu sürükle-bırak (15 dk yakalama) → yeniden planlama.
 *  - MonthView: ay ızgarası, gün başına özet; güne tıklama → gün görünümü.
 *  - Pilates (grup) dersleri ayrı renkte, sürüklenemeyen bloklar olarak gösterilir; tıklayınca ders detayı açılır.
 */
import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { DateTime } from 'luxon';
import { Dumbbell, MapPin, Video } from 'lucide-react';
import { TIME_ZONE, APPOINTMENT_STATUS_LABEL } from '@shared/constants';
import { minutesOf, timeOf } from '@shared/time';
import { cn } from '@/lib/format';
import { STATUS_BLOCK } from '../ui';
import { displayName, type AppointmentDTO, type DayPlanDTO } from './types';
import type { ClassSessionDTO } from '@shared/classes';

const HOUR_PX = 64;
const SNAP = 15;
const DRAGGABLE = new Set(['NEW_REQUEST', 'PENDING', 'CONFIRMED']);

type Entry = { kind: 'appt'; a: AppointmentDTO } | { kind: 'class'; c: ClassSessionDTO };
type Placed = Entry & { start: number; end: number; lane: number; lanes: number };

/** Takvimde ders bloğu rengi (randevu durum renklerinden ayrışır) */
const CLASS_BLOCK = 'bg-info/15 border-info text-info-ink';

/** Çakışan blokları yan yana şeritlere yerleştir */
function layout(items: AppointmentDTO[], classes: ClassSessionDTO[] = []): Placed[] {
  const sorted = [
    ...items
      .filter((a) => a.time && a.durationMinutes)
      .map((a) => ({ kind: 'appt' as const, a, start: minutesOf(a.time!), end: minutesOf(a.time!) + a.durationMinutes! })),
    ...classes.map((c) => ({ kind: 'class' as const, c, start: minutesOf(c.time), end: minutesOf(c.time) + c.durationMinutes })),
  ].sort((x, y) => x.start - y.start || y.end - x.end);
  const out: Placed[] = [];
  let cluster: Placed[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const lanes = Math.max(1, ...cluster.map((c) => c.lane + 1));
    cluster.forEach((c) => (c.lanes = lanes));
    out.push(...cluster);
    cluster = [];
  };
  for (const s of sorted) {
    if (s.start >= clusterEnd && cluster.length) flush();
    const used = new Set(cluster.filter((c) => c.end > s.start).map((c) => c.lane));
    let lane = 0;
    while (used.has(lane)) lane++;
    cluster.push({ ...s, lane, lanes: 1 });
    clusterEnd = Math.max(clusterEnd, s.end);
  }
  if (cluster.length) flush();
  return out;
}

export function TimeGrid({
  days, items, classes = [], plans, onSelect, onSelectClass, onCreate, onMove, compact = false,
}: {
  days: string[];
  items: AppointmentDTO[];
  classes?: ClassSessionDTO[];
  onSelectClass?: (id: string) => void;
  plans: Map<string, DayPlanDTO>;
  onSelect: (id: string) => void;
  onCreate: (date: string, time: string) => void;
  onMove: (a: AppointmentDTO, date: string, time: string) => void;
  compact?: boolean;
}) {
  // Görünür saat aralığı: 08–20, çalışma pencereleri/randevular daha geniş ise genişlet
  const [startH, endH] = useMemo(() => {
    let s = 8, e = 20;
    for (const p of plans.values()) for (const w of p.windows) { s = Math.min(s, Math.floor(w.start / 60)); e = Math.max(e, Math.ceil(w.end / 60)); }
    for (const a of items) if (a.time && a.durationMinutes) { const st = minutesOf(a.time); s = Math.min(s, Math.floor(st / 60)); e = Math.max(e, Math.ceil((st + a.durationMinutes) / 60)); }
    for (const c of classes) { const st = minutesOf(c.time); s = Math.min(s, Math.floor(st / 60)); e = Math.max(e, Math.ceil((st + c.durationMinutes) / 60)); }
    return [Math.max(0, s), Math.min(24, e)];
  }, [plans, items, classes]);
  const hours = Array.from({ length: endH - startH }, (_, i) => startH + i);
  const gridH = hours.length * HOUR_PX;
  const y = (min: number) => ((min - startH * 60) / 60) * HOUR_PX;

  const byDay = useMemo(() => {
    const m = new Map<string, AppointmentDTO[]>();
    for (const a of items) if (a.date) m.set(a.date, [...(m.get(a.date) ?? []), a]);
    return m;
  }, [items]);
  const classesByDay = useMemo(() => {
    const m = new Map<string, ClassSessionDTO[]>();
    for (const c of classes) m.set(c.date, [...(m.get(c.date) ?? []), c]);
    return m;
  }, [classes]);

  // ── Sürükle-bırak ──
  const [drag, setDrag] = useState<{ a: AppointmentDTO; date: string; start: number; active: boolean } | null>(null);
  const dragRef = useRef<{ a: AppointmentDTO; x: number; y: number; offset: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const locate = (clientX: number, clientY: number, offset: number) => {
    const el = document.elementsFromPoint(clientX, clientY).find((e) => (e as HTMLElement).dataset?.daycol) as HTMLElement | undefined;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const raw = ((clientY - rect.top - offset) / HOUR_PX) * 60 + startH * 60;
    const snapped = Math.round(raw / SNAP) * SNAP;
    return { date: el.dataset.daycol!, start: Math.max(startH * 60, Math.min(snapped, endH * 60 - SNAP)) };
  };

  const onPointerDown = (e: RPointerEvent<HTMLButtonElement>, a: AppointmentDTO) => {
    if (!DRAGGABLE.has(a.status) || e.button !== 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    dragRef.current = { a, x: e.clientX, y: e.clientY, offset: e.clientY - rect.top, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: RPointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 5) return;
    d.moved = true;
    const loc = locate(e.clientX, e.clientY, d.offset);
    if (loc) setDrag({ a: d.a, date: loc.date, start: loc.start, active: true });
  };
  const onPointerUp = (e: RPointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d?.moved) return;
    suppressClick.current = true;
    setTimeout(() => (suppressClick.current = false), 50);
    const loc = locate(e.clientX, e.clientY, d.offset);
    setDrag(null);
    if (!loc) return;
    const time = timeOf(loc.start);
    if (loc.date === d.a.date && time === d.a.time) return;
    onMove(d.a, loc.date, time);
  };

  const onColumnClick = (e: React.MouseEvent<HTMLDivElement>, date: string) => {
    if (suppressClick.current || e.target !== e.currentTarget) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const min = Math.floor((((e.clientY - rect.top) / HOUR_PX) * 60 + startH * 60) / SNAP) * SNAP;
    onCreate(date, timeOf(min));
  };

  // Şimdi çizgisi + ilk açılışta mesai başlangıcına kaydır
  const now = DateTime.now().setZone(TIME_ZONE);
  const today = now.toISODate()!;
  const nowMin = now.hour * 60 + now.minute;
  useEffect(() => {
    const first = [...plans.values()].flatMap((p) => p.windows).map((w) => w.start).sort((a, b) => a - b)[0];
    const target = days.includes(today) && nowMin > startH * 60 ? nowMin - 60 : first ?? 9 * 60;
    scrollRef.current?.scrollTo({ top: Math.max(0, y(target) - 16) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days.join(','), startH]);

  const colMin = compact ? 'min-w-[11rem]' : days.length > 1 ? 'min-w-[8.5rem]' : 'min-w-[16rem]';

  return (
    <div className="overflow-x-auto" role="region" aria-label="Takvim">
      <div className="min-w-fit">
        {/* Gün başlıkları */}
        <div className="sticky top-0 z-10 flex border-b border-panel-line bg-white">
          <div className="w-14 shrink-0" />
          {days.map((d) => {
            const dt = DateTime.fromISO(d, { zone: TIME_ZONE });
            const p = plans.get(d);
            const isToday = d === today;
            return (
              <div key={d} className={cn('flex-1 border-l border-panel-line px-2 py-2.5 text-center', colMin)}>
                <p className="text-[0.7rem] font-semibold tracking-wide text-panel-muted uppercase">{dt.toFormat('ccc')}</p>
                <p className={cn('mx-auto mt-0.5 flex h-8 w-8 items-center justify-center rounded-full text-[1.05rem] font-bold tabular', isToday ? 'bg-cocoa text-ivory' : 'text-espresso')}>{dt.day}</p>
                {p && !p.isWorking && <p className="mt-0.5 truncate text-[0.68rem] text-panel-muted" title={p.closedReason ?? ''}>{p.closedReason ?? 'Kapalı'}</p>}
              </div>
            );
          })}
        </div>
        <div ref={scrollRef} className="relative max-h-[calc(100dvh-17rem)] min-h-[28rem] overflow-y-auto">
          <div className="flex" style={{ height: gridH }}>
            <div className="relative w-14 shrink-0">
              {hours.map((h) => (
                <span key={h} className="absolute right-2 -translate-y-1/2 text-[0.7rem] text-panel-muted tabular" style={{ top: y(h * 60) }}>
                  {h === startH ? '' : `${String(h).padStart(2, '0')}:00`}
                </span>
              ))}
            </div>
            {days.map((d) => {
              const p = plans.get(d);
              const placed = layout(byDay.get(d) ?? [], classesByDay.get(d) ?? []);
              return (
                <div
                  key={d}
                  data-daycol={d}
                  onClick={(e) => onColumnClick(e, d)}
                  className={cn('relative flex-1 cursor-cell border-l border-panel-line', colMin)}
                  style={{
                    height: gridH,
                    backgroundColor: '#F3EEE6',
                    backgroundImage: 'repeating-linear-gradient(135deg, transparent 0 7px, rgba(48,34,25,0.035) 7px 8px)',
                  }}
                  title="Boş alana tıklayarak randevu ekleyin"
                >
                  {/* Çalışma pencereleri */}
                  {p?.windows.map((w) => (
                    <div key={w.start} className="pointer-events-none absolute inset-x-0 bg-white" style={{ top: y(w.start), height: y(w.end) - y(w.start) }} />
                  ))}
                  {/* Saat çizgileri */}
                  {hours.map((h) => (
                    <div key={h} className="pointer-events-none absolute inset-x-0 border-t border-panel-line/70" style={{ top: y(h * 60) }} />
                  ))}
                  {hours.map((h) => (
                    <div key={`h${h}`} className="pointer-events-none absolute inset-x-0 border-t border-dashed border-panel-line/40" style={{ top: y(h * 60 + 30) }} />
                  ))}
                  {d === today && nowMin >= startH * 60 && nowMin <= endH * 60 && (
                    <div className="pointer-events-none absolute inset-x-0 z-20 border-t-2 border-danger" style={{ top: y(nowMin) }}>
                      <span className="absolute -top-[5px] -left-1 h-2 w-2 rounded-full bg-danger" />
                    </div>
                  )}
                  {placed.map((p) => {
                    const { start, end, lane, lanes } = p;
                    const h = Math.max(22, y(end) - y(start) - 2);
                    const box = { top: y(start) + 1, height: h, left: `calc(${(lane / lanes) * 100}% + 3px)`, width: `calc(${100 / lanes}% - 6px)` };
                    if (p.kind === 'class') {
                      const c = p.c;
                      return (
                        <button
                          key={`c-${c.id}`}
                          type="button"
                          onClick={() => onSelectClass?.(c.id)}
                          className={cn(
                            'absolute z-10 overflow-hidden rounded-md border-l-[3px] px-2 py-1 text-left text-[0.75rem] leading-tight transition-shadow hover:shadow-md focus-visible:z-30',
                            CLASS_BLOCK,
                            c.status === 'CANCELLED' && 'line-through opacity-60',
                          )}
                          style={box}
                          aria-label={`Pilates: ${c.title}, ${c.time}, ${c.seatsTaken}/${c.capacity} kişi`}
                        >
                          <p className="flex items-center gap-1 truncate font-bold"><Dumbbell className="h-3 w-3 shrink-0" />{c.title}</p>
                          {h > 34 && (
                            <p className="mt-0.5 truncate tabular opacity-80">
                              {c.time}–{timeOf(minutesOf(c.time) + c.durationMinutes)} · {c.seatsTaken}/{c.capacity}
                            </p>
                          )}
                        </button>
                      );
                    }
                    const a = p.a;
                    const isDragging = drag?.a.id === a.id;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onPointerDown={(e) => onPointerDown(e, a)}
                        onPointerMove={onPointerMove}
                        onPointerUp={onPointerUp}
                        onPointerCancel={() => { dragRef.current = null; setDrag(null); }}
                        onClick={() => !suppressClick.current && onSelect(a.id)}
                        className={cn(
                          'absolute z-10 overflow-hidden rounded-md border-l-[3px] px-2 py-1 text-left text-[0.75rem] leading-tight transition-shadow hover:shadow-md focus-visible:z-30',
                          STATUS_BLOCK[a.status],
                          DRAGGABLE.has(a.status) && 'cursor-grab touch-none active:cursor-grabbing',
                          isDragging && 'opacity-35',
                        )}
                        style={box}
                        aria-label={`${displayName(a)}, ${a.time}, ${APPOINTMENT_STATUS_LABEL[a.status]}`}
                      >
                        <p className="truncate font-bold">{displayName(a)}</p>
                        {h > 34 && (
                          <p className="mt-0.5 flex items-center gap-1 truncate tabular opacity-80">
                            {a.meetingType === 'ONLINE' ? <Video className="h-3 w-3 shrink-0" /> : <MapPin className="h-3 w-3 shrink-0" />}
                            {a.time}–{timeOf(minutesOf(a.time!) + a.durationMinutes!)}
                          </p>
                        )}
                      </button>
                    );
                  })}
                  {drag && drag.date === d && (
                    <div
                      className="pointer-events-none absolute inset-x-1 z-30 rounded-md border-2 border-dashed border-cocoa bg-cocoa/10 px-2 py-1 text-[0.75rem] font-bold text-cocoa"
                      style={{ top: y(drag.start) + 1, height: Math.max(22, ((drag.a.durationMinutes ?? 45) / 60) * HOUR_PX - 2) }}
                    >
                      <span className="tabular">{timeOf(drag.start)}</span> · {displayName(drag.a)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

const DOT: Record<string, string> = {
  NEW_REQUEST: 'bg-rose-deep',
  PENDING: 'bg-warning',
  CONFIRMED: 'bg-success',
  COMPLETED: 'bg-cocoa',
  CANCELLED: 'bg-danger/60',
  NO_SHOW: 'bg-panel-muted',
};

export function MonthView({
  anchor, items, classes = [], plans, onPickDay, onSelect, onSelectClass,
}: {
  anchor: string;
  items: AppointmentDTO[];
  classes?: ClassSessionDTO[];
  onSelectClass?: (id: string) => void;
  plans: Map<string, DayPlanDTO>;
  onPickDay: (date: string) => void;
  onSelect: (id: string) => void;
}) {
  const a = DateTime.fromISO(anchor, { zone: TIME_ZONE });
  const start = a.startOf('month').startOf('week');
  const end = a.endOf('month').endOf('week');
  const days: string[] = [];
  for (let d = start; d <= end; d = d.plus({ days: 1 })) days.push(d.toISODate()!);
  const today = DateTime.now().setZone(TIME_ZONE).toISODate();
  type MonthEntry = { id: string; time: string; label: string; dot: string; cancelled: boolean; open: () => void };
  const byDay = new Map<string, MonthEntry[]>();
  const push = (date: string, e: MonthEntry) => byDay.set(date, [...(byDay.get(date) ?? []), e]);
  for (const x of items) {
    if (x.date) push(x.date, { id: x.id, time: x.time ?? '', label: displayName(x), dot: DOT[x.status]!, cancelled: x.status === 'CANCELLED', open: () => onSelect(x.id) });
  }
  for (const c of classes) {
    push(c.date, { id: `c-${c.id}`, time: c.time, label: `${c.title} (${c.seatsTaken}/${c.capacity})`, dot: 'bg-info', cancelled: c.status === 'CANCELLED', open: () => onSelectClass?.(c.id) });
  }
  byDay.forEach((v) => v.sort((p, q) => p.time.localeCompare(q.time)));
  const weekdays = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

  return (
    <div>
      <div className="grid grid-cols-7 border-b border-panel-line text-center text-[0.7rem] font-semibold tracking-wide text-panel-muted uppercase">
        {weekdays.map((w) => <div key={w} className="py-2">{w}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const dt = DateTime.fromISO(d, { zone: TIME_ZONE });
          const inMonth = dt.month === a.month;
          const list = byDay.get(d) ?? [];
          const p = plans.get(d);
          return (
            <div
              key={d}
              className={cn(
                'min-h-[5.5rem] border-r border-b border-panel-line p-1.5 sm:min-h-[7.5rem] sm:p-2 [&:nth-child(7n)]:border-r-0',
                !inMonth && 'bg-panel-bg/50',
                inMonth && p && !p.isWorking && 'bg-[#F6F2EB]',
              )}
            >
              <button
                type="button"
                onClick={() => onPickDay(d)}
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full text-[0.82rem] font-bold tabular hover:bg-panel-bg',
                  d === today ? 'bg-cocoa text-ivory hover:bg-cocoa' : inMonth ? 'text-espresso' : 'text-panel-muted/60',
                )}
                aria-label={`${dt.toFormat('d MMMM')} gün görünümü (${list.length} kayıt)`}
              >
                {dt.day}
              </button>
              {/* Mobil: noktalar */}
              {list.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1 sm:hidden" aria-hidden>
                  {list.slice(0, 6).map((x) => <span key={x.id} className={cn('h-1.5 w-1.5 rounded-full', x.dot)} />)}
                </div>
              )}
              <ul className="mt-1 hidden space-y-0.5 sm:block">
                {list.slice(0, 3).map((x) => (
                  <li key={x.id}>
                    <button type="button" onClick={x.open} className={cn('flex w-full items-center gap-1.5 truncate rounded px-1 py-0.5 text-left text-[0.72rem] hover:bg-panel-bg', x.cancelled && 'line-through opacity-60')}>
                      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', x.dot)} />
                      <span className="tabular text-panel-muted">{x.time}</span>
                      <span className="truncate font-semibold text-espresso">{x.label}</span>
                    </button>
                  </li>
                ))}
                {list.length > 3 && (
                  <li>
                    <button type="button" onClick={() => onPickDay(d)} className="px-1 text-[0.72rem] font-semibold text-cocoa hover:underline">+{list.length - 3} daha</button>
                  </li>
                )}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const STATUS_DOT = DOT;
