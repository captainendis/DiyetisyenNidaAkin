// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

'use client';

/**
 * /panel/randevular — Liste | Gün | Hafta | Ay
 * URL parametreleri: view, d (görünüm tarihi), id (detay modalı), new=1 (&clientId, date, time),
 *   ders (pilates dersi detayı / yoklama). Pilates dersleri (tek ders ve haftalık program) de buradan girilir.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from '@/lib/router';
import { DateTime } from 'luxon';
import { ChevronLeft, ChevronRight, Dumbbell, Inbox, Plus, Repeat } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn, formatDayStr, todayStr } from '@/lib/format';
import { APPOINTMENT_STATUS_LABEL, TIME_ZONE, type AppointmentStatus } from '@shared/constants';
import { usePanelAuth, RequirePermission } from '@/components/panel/PanelAuth';
import { Button, Card, ErrorState, PageHeader, Skeleton, Switch, useFeedback } from '@/components/panel/ui';
import AppointmentDetailModal from '@/components/panel/appointments/AppointmentDetailModal';
import NewAppointmentModal from '@/components/panel/appointments/NewAppointmentModal';
import { AppointmentList, type ListFilters } from '@/components/panel/appointments/AppointmentList';
import { MonthView, STATUS_DOT, TimeGrid } from '@/components/panel/appointments/CalendarViews';
import { displayName, type AppointmentDTO, type DayPlanDTO } from '@/components/panel/appointments/types';
import type { ClassGroupDTO, ClassSessionDTO } from '@shared/classes';
import { NewSessionModal } from '@/components/panel/classes/NewSessionModal';
import { RecurringModal } from '@/components/panel/classes/RecurringModal';
import { SessionModal } from '@/components/panel/classes/SessionModal';

type View = 'list' | 'day' | 'week' | 'month';
const VIEWS: { value: View; label: string }[] = [
  { value: 'list', label: 'Liste' },
  { value: 'day', label: 'Gün' },
  { value: 'week', label: 'Hafta' },
  { value: 'month', label: 'Ay' },
];

function rangeFor(view: View, anchor: string): [string, string] {
  const a = DateTime.fromISO(anchor, { zone: TIME_ZONE });
  if (view === 'day') return [anchor, anchor];
  if (view === 'week') return [a.startOf('week').toISODate()!, a.endOf('week').toISODate()!];
  return [a.startOf('month').startOf('week').toISODate()!, a.endOf('month').endOf('week').toISODate()!];
}

function Inner() {
  const [params, setParams] = useSearchParams();
  const isMobile = useMediaQuery('(max-width: 767px)');
  const fb = useFeedback();
  const { can, refreshUnread } = usePanelAuth();
  const canWrite = can('appointments:write');

  const view = (params.get('view') as View) || (isMobile ? 'day' : 'week');
  const anchor = params.get('d') || todayStr();
  const openId = params.get('id');
  const newOpen = params.get('new') === '1';
  const [refreshKey, setRefreshKey] = useState(0);
  const [showCancelled, setShowCancelled] = useState(false);
  const [filters, setFilters] = useState<ListFilters>(() => ({
    from: '',
    to: '',
    statuses: (params.getAll('status') as AppointmentStatus[]) ?? [],
    meetingType: '',
    kind: params.get('kind') === 'PILATES' ? 'PILATES' : '',
    q: '',
  }));

  const update = useCallback(
    (patch: Record<string, string | null>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(patch)) {
            if (v === null) next.delete(k);
            else next.set(k, v);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );
  const bump = () => {
    setRefreshKey((k) => k + 1);
    refreshUnread();
  };

  const [from, to] = rangeFor(view === 'list' ? 'week' : view, anchor);
  const cal = useApi(async () => {
    if (view === 'list') return null;
    const [appts, plans, classes] = await Promise.all([
      api.get<{ items: AppointmentDTO[] }>('/appointments', { from, to, pageSize: 500, sort: 'startsAt' }),
      api.get<{ days: DayPlanDTO[] }>('/appointments/day-plans', { from, to }),
      // Pilates dersleri de takvimde zaman kaplar
      api.get<{ items: ClassSessionDTO[] }>('/classes/sessions', { from, to, includeCancelled: '1' }).catch(() => ({ items: [] as ClassSessionDTO[] })),
    ]);
    return { items: appts.items.filter((a) => a.date), classes: classes.items, plans: new Map(plans.days.map((p) => [p.date, p])) };
  }, [view, from, to, refreshKey]);

  const unscheduled = useApi(() => api.get<{ total: number }>('/appointments', { status: 'NEW_REQUEST', pageSize: 1 }), [refreshKey]);

  const items = useMemo(
    () => (cal.data?.items ?? []).filter((a) => showCancelled || (a.status !== 'CANCELLED' && a.status !== 'NO_SHOW')),
    [cal.data, showCancelled],
  );
  const classes = useMemo(() => (cal.data?.classes ?? []).filter((c) => showCancelled || c.status !== 'CANCELLED'), [cal.data, showCancelled]);
  const openClass = (id: string) => update({ ders: id });
  const classId = params.get('ders');
  const [newClass, setNewClass] = useState<{ date?: string; time?: string } | null>(null);
  const [recurringOpen, setRecurringOpen] = useState(false);
  const groups = useApi(() => api.get<{ items: ClassGroupDTO[] }>('/classes/groups'), [refreshKey]);
  const days = useMemo(() => {
    const out: string[] = [];
    for (let d = DateTime.fromISO(from, { zone: TIME_ZONE }); d.toISODate()! <= to; d = d.plus({ days: 1 })) out.push(d.toISODate()!);
    return out;
  }, [from, to]);

  const shift = (dir: -1 | 1) => {
    const a = DateTime.fromISO(anchor, { zone: TIME_ZONE });
    const n = view === 'day' ? a.plus({ days: dir }) : view === 'week' ? a.plus({ weeks: dir }) : a.plus({ months: dir });
    update({ d: n.toISODate()! });
  };

  const title = useMemo(() => {
    const a = DateTime.fromISO(anchor, { zone: TIME_ZONE });
    if (view === 'day') return a.toFormat('d MMMM yyyy, cccc');
    if (view === 'month') return a.toFormat('LLLL yyyy');
    const s = DateTime.fromISO(from, { zone: TIME_ZONE });
    const e = DateTime.fromISO(to, { zone: TIME_ZONE });
    return s.month === e.month ? `${s.day}–${e.toFormat('d MMMM yyyy')}` : `${s.toFormat('d MMM')} – ${e.toFormat('d MMM yyyy')}`;
  }, [anchor, view, from, to]);

  const onMove = async (a: AppointmentDTO, date: string, time: string) => {
    const ok = await fb.confirm({
      title: 'Randevu saati değiştirilsin mi?',
      description: (
        <>
          <strong>{displayName(a)}</strong>
          <br />
          <span className="tabular">{formatDayStr(a.date!, 'd MMMM, cccc')} {a.time}</span> →{' '}
          <span className="tabular font-semibold text-espresso">{formatDayStr(date, 'd MMMM, cccc')} {time}</span>
          <br />
          <span className="text-panel-muted">Çakışma ve çalışma saati kontrolü kayıt sırasında yapılır.</span>
        </>
      ),
      confirmLabel: 'Saati değiştir',
    });
    if (!ok) return;
    try {
      await api.patch(`/appointments/${a.id}`, { date, time });
      fb.success('Randevu taşındı', `${formatDayStr(date, 'd MMMM')} · ${time}`);
      bump();
    } catch (e) {
      fb.error('Randevu taşınamadı', e instanceof ApiError ? e.message : undefined);
      bump();
    }
  };

  // Liste filtrelerini URL'deki status ile senkron tut (bildirim/dashboard bağlantıları için)
  useEffect(() => {
    const st = params.getAll('status') as AppointmentStatus[];
    if (st.length) setFilters((f) => ({ ...f, statuses: st }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <PageHeader
        title="Randevular"
        description="Talepleri onaylayın, randevuları ve pilates derslerini planlayın; derse tıklayarak yoklama alın."
        actions={
          canWrite && (
            <>
              <Button variant="secondary" icon={<Repeat className="h-4 w-4" />} onClick={() => setRecurringOpen(true)}>Ders programı</Button>
              <Button variant="secondary" icon={<Dumbbell className="h-4 w-4" />} onClick={() => setNewClass({ date: view === 'list' ? undefined : anchor })}>Pilates dersi</Button>
              <Button icon={<Plus className="h-4 w-4" />} onClick={() => update({ new: '1' })}>Yeni randevu</Button>
            </>
          )
        }
      />

      {!!unscheduled.data?.total && (
        <Link
          to="/panel/talepler"
          className="mb-4 flex items-center gap-3 rounded-xl border border-rose/60 bg-rose/15 px-4 py-3 text-sm text-[#6f4336] hover:bg-rose/25"
        >
          <Inbox className="h-4 w-4 shrink-0" />
          <span>
            <strong className="tabular">{unscheduled.data.total}</strong> geri arama talebi saat atanmayı bekliyor; takvimde görünmezler.
          </span>
          <span className="ml-auto font-semibold whitespace-nowrap underline underline-offset-4">Taleplere git</span>
        </Link>
      )}

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-panel-line px-4 py-3 sm:px-5">
          <div role="tablist" aria-label="Görünüm" className="inline-flex rounded-lg bg-panel-bg p-1">
            {VIEWS.map((v) => (
              <button
                key={v.value}
                role="tab"
                type="button"
                aria-selected={view === v.value}
                onClick={() => update({ view: v.value })}
                className={cn('rounded-md px-3 py-1.5 text-[0.82rem] font-semibold transition-colors', view === v.value ? 'bg-white text-espresso shadow-sm' : 'text-panel-muted hover:text-cocoa')}
              >
                {v.label}
              </button>
            ))}
          </div>
          {view !== 'list' && (
            <>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => shift(-1)} aria-label="Önceki"><ChevronLeft className="h-4 w-4" /></Button>
                <Button variant="secondary" size="sm" onClick={() => update({ d: todayStr() })}>Bugün</Button>
                <Button variant="ghost" size="sm" onClick={() => shift(1)} aria-label="Sonraki"><ChevronRight className="h-4 w-4" /></Button>
              </div>
              <h2 className="text-[0.95rem] font-bold text-espresso capitalize tabular">{title}</h2>
              <div className="ml-auto flex items-center gap-4">
                <ul className="hidden items-center gap-3 xl:flex" aria-label="Durum renkleri">
                  {(['PENDING', 'CONFIRMED', 'COMPLETED'] as AppointmentStatus[]).map((s) => (
                    <li key={s} className="flex items-center gap-1.5 text-[0.75rem] text-panel-muted">
                      <span className={cn('h-2 w-2 rounded-full', STATUS_DOT[s])} /> {APPOINTMENT_STATUS_LABEL[s]}
                    </li>
                  ))}
                  <li className="flex items-center gap-1.5 text-[0.75rem] text-panel-muted">
                    <span className="h-2 w-2 rounded-full bg-info" /> Pilates
                  </li>
                </ul>
                <Switch checked={showCancelled} onChange={setShowCancelled} label={<span className="text-[0.8rem]">İptal / gelmeyenler</span>} />
              </div>
            </>
          )}
        </div>

        {view === 'list' ? (
          <AppointmentList filters={filters} setFilters={setFilters} onOpen={(id) => update({ id })} refreshKey={refreshKey} onChanged={bump} />
        ) : cal.error ? (
          <ErrorState message={cal.error.message} onRetry={cal.reload} />
        ) : !cal.data ? (
          <div className="space-y-3 p-5" aria-busy="true">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-[26rem] w-full" />
          </div>
        ) : view === 'month' ? (
          <MonthView anchor={anchor} items={items} classes={classes} plans={cal.data.plans} onPickDay={(d) => update({ view: 'day', d })} onSelect={(id) => update({ id })} onSelectClass={openClass} />
        ) : (
          <>
            <TimeGrid
              days={days}
              items={items}
              classes={classes}
              plans={cal.data.plans}
              compact={isMobile}
              onSelect={(id) => update({ id })}
              onSelectClass={openClass}
              onCreate={(date, time) => canWrite && update({ new: '1', date, time })}
              onMove={canWrite ? onMove : () => {}}
            />
            {items.length === 0 && classes.length === 0 && (
              <p className="border-t border-panel-line px-5 py-3 text-center text-sm text-panel-muted">
                {view === 'day' ? 'Bu gün için randevu bulunmuyor.' : 'Bu hafta için randevu bulunmuyor.'} Boş bir saate tıklayarak randevu ekleyebilirsiniz.
              </p>
            )}
          </>
        )}
      </Card>

      <NewSessionModal
        open={!!newClass}
        groups={groups.data?.items ?? []}
        initial={newClass ?? undefined}
        onClose={() => setNewClass(null)}
        onCreated={(s) => {
          bump();
          if (view !== 'list') update({ d: s.date });
        }}
      />
      <RecurringModal open={recurringOpen} groups={groups.data?.items ?? []} onClose={() => setRecurringOpen(false)} onDone={bump} />
      <SessionModal sessionId={classId} open={!!classId} onClose={() => update({ ders: null })} onChanged={bump} />
      <AppointmentDetailModal appointmentId={openId} open={!!openId} onClose={() => update({ id: null })} onChanged={bump} />
      <NewAppointmentModal
        open={newOpen}
        onClose={() => update({ new: null, clientId: null, date: null, time: null })}
        initial={{ date: params.get('date') ?? undefined, time: params.get('time') ?? undefined, clientId: params.get('clientId') ?? undefined }}
        onCreated={(a) => {
          bump();
          if (a.date && view !== 'list') update({ d: a.date, new: null, clientId: null, date: null, time: null });
        }}
      />
    </>
  );
}

export default function AppointmentsPage() {
  return (
    <RequirePermission perm="appointments:read">
      <Inner />
    </RequirePermission>
  );
}
