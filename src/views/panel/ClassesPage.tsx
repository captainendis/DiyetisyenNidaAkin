// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

'use client';

/**
 * /panel/pilates — grup dersleri
 *  - Program: haftalık ders listesi (gün gün), derse tıklayınca yoklama
 *  - Gruplar: sabit gruplar, üyeler, kontenjan, haftalık düzen
 * URL parametreleri: sekme (program | gruplar), d (hafta), ders (detay modalı)
 */
import { useCallback, useMemo, useState } from 'react';
import { DateTime } from 'luxon';
import { CalendarPlus, ChevronLeft, ChevronRight, Dumbbell, MoreHorizontal, Pencil, Plus, Power, Repeat, Trash2, Users } from 'lucide-react';
import { Link, useSearchParams } from '@/lib/router';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import { cn, formatDateTime, formatDayStr, todayStr } from '@/lib/format';
import { TIME_ZONE } from '@shared/constants';
import { minutesOf, timeOf } from '@shared/time';
import { RequirePermission, usePanelAuth } from '@/components/panel/PanelAuth';
import { Badge, Button, Card, EmptyState, ErrorState, PageHeader, Skeleton, SkeletonRows, Switch, Tabs, useFeedback } from '@/components/panel/ui';
import { GroupFormModal } from '@/components/panel/classes/GroupFormModal';
import { RecurringModal } from '@/components/panel/classes/RecurringModal';
import { NewSessionModal } from '@/components/panel/classes/NewSessionModal';
import { SessionModal } from '@/components/panel/classes/SessionModal';
import { SeatDots, SessionStatusBadge, clientName, patternLabel, type ClassGroupDTO, type ClassSessionDTO } from '@/components/panel/classes/shared';

type Tab = 'program' | 'gruplar';

function weekRange(anchor: string): [string, string] {
  const a = DateTime.fromISO(anchor, { zone: TIME_ZONE });
  return [a.startOf('week').toISODate()!, a.endOf('week').toISODate()!];
}

// ───────────────────────── Program ─────────────────────────

function SessionRow({ s, onOpen }: { s: ClassSessionDTO; onOpen: () => void }) {
  const end = timeOf(minutesOf(s.time) + s.durationMinutes);
  const holding = s.attendees.filter((a) => a.status !== 'EXCUSED');
  const excused = s.attendees.length - holding.length;
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          'flex w-full flex-col gap-2 px-4 py-3 text-left transition-colors hover:bg-panel-bg/70 sm:flex-row sm:items-center sm:gap-5 sm:px-5',
          s.status === 'CANCELLED' && 'opacity-60',
        )}
      >
        <span className="tabular w-24 shrink-0 text-[0.95rem] font-bold text-espresso">{s.time}<span className="font-normal text-panel-muted">–{end}</span></span>
        <span className="min-w-0 flex-1">
          <span className={cn('block truncate font-semibold text-espresso', s.status === 'CANCELLED' && 'line-through')}>{s.title}</span>
          <span className="mt-0.5 block truncate text-[0.8rem] text-panel-muted">
            {holding.length ? holding.map((a) => clientName(a.client)).join(', ') : 'Katılımcı yok'}
            {excused > 0 && ` · ${excused} kişi haber verdi`}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-3">
          <SeatDots taken={s.seatsTaken} capacity={s.capacity} />
          <SessionStatusBadge status={s.status} />
        </span>
      </button>
    </li>
  );
}

function ProgramTab({ anchor, setAnchor, refreshKey, onOpen, onNew }: { anchor: string; setAnchor: (d: string) => void; refreshKey: number; onOpen: (id: string) => void; onNew: (date: string) => void }) {
  const [from, to] = weekRange(anchor);
  const [showCancelled, setShowCancelled] = useState(false);
  const { can } = usePanelAuth();
  const { data, error, loading, reload } = useApi(
    () => api.get<{ items: ClassSessionDTO[] }>('/classes/sessions', { from, to, includeCancelled: showCancelled ? '1' : undefined }),
    [from, to, showCancelled, refreshKey],
  );
  const days = useMemo(() => {
    const out: string[] = [];
    for (let d = from; d <= to; d = DateTime.fromISO(d, { zone: TIME_ZONE }).plus({ days: 1 }).toISODate()!) out.push(d);
    return out;
  }, [from, to]);
  const byDay = useMemo(() => {
    const m = new Map<string, ClassSessionDTO[]>();
    for (const s of data?.items ?? []) m.set(s.date, [...(m.get(s.date) ?? []), s]);
    return m;
  }, [data]);
  const shift = (w: number) => setAnchor(DateTime.fromISO(anchor, { zone: TIME_ZONE }).plus({ weeks: w }).toISODate()!);
  const s = DateTime.fromISO(from, { zone: TIME_ZONE });
  const e = DateTime.fromISO(to, { zone: TIME_ZONE });
  const title = s.month === e.month ? `${s.day}–${e.toFormat('d MMMM yyyy')}` : `${s.toFormat('d MMM')} – ${e.toFormat('d MMM yyyy')}`;
  const today = todayStr();
  const total = data?.items.filter((x) => x.status !== 'CANCELLED').length ?? 0;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-panel-line px-4 py-3 sm:px-5">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => shift(-1)} aria-label="Önceki hafta"><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="secondary" size="sm" onClick={() => setAnchor(todayStr())}>Bu hafta</Button>
          <Button variant="ghost" size="sm" onClick={() => shift(1)} aria-label="Sonraki hafta"><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <h2 className="tabular text-[0.95rem] font-bold text-espresso">{title}</h2>
        {data && <span className="tabular text-[0.8rem] text-panel-muted">{total} ders</span>}
        <div className="ml-auto"><Switch checked={showCancelled} onChange={setShowCancelled} label={<span className="text-[0.8rem]">İptal edilenler</span>} /></div>
      </div>
      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : loading && !data ? (
        <SkeletonRows rows={5} />
      ) : (
        <div className="divide-y divide-panel-line">
          {days.map((d) => {
            const list = byDay.get(d) ?? [];
            const past = d < today;
            if (!list.length && past) return null;
            return (
              <section key={d} aria-label={formatDayStr(d, 'd MMMM cccc')}>
                <div className={cn('flex items-center justify-between bg-panel-bg/50 px-4 py-2 sm:px-5', d === today && 'bg-rose/15')}>
                  <h3 className="text-[0.8rem] font-bold text-cocoa capitalize">
                    {formatDayStr(d, 'cccc')} <span className="tabular font-normal text-panel-muted">{formatDayStr(d, 'd MMMM')}</span>
                    {d === today && <Badge tone="dark" className="ml-2">Bugün</Badge>}
                  </h3>
                  {can('appointments:write') && !past && (
                    <button type="button" onClick={() => onNew(d)} className="inline-flex items-center gap-1 text-[0.75rem] font-semibold text-cocoa hover:underline">
                      <Plus className="h-3.5 w-3.5" /> Ders
                    </button>
                  )}
                </div>
                {list.length ? (
                  <ul className="divide-y divide-panel-line">{list.map((x) => <SessionRow key={x.id} s={x} onOpen={() => onOpen(x.id)} />)}</ul>
                ) : (
                  <p className="px-5 py-3 text-[0.82rem] text-panel-muted">Ders yok.</p>
                )}
              </section>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ───────────────────────── Gruplar ─────────────────────────

function GroupCard({ g, onEdit, onSchedule, onToggle, onDelete, onOpenSession }: {
  g: ClassGroupDTO;
  onEdit: () => void;
  onSchedule: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onOpenSession: (id: string) => void;
}) {
  const { can } = usePanelAuth();
  const canWrite = can('appointments:write');
  const [menu, setMenu] = useState(false);
  return (
    <Card as="article" className={cn('flex flex-col', !g.isActive && 'bg-panel-bg/40')}>
      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <div className="min-w-0">
          <h3 className="truncate text-[1.02rem] font-bold text-espresso">{g.name}</h3>
          <p className="mt-0.5 text-[0.8rem] text-panel-muted">{g.pattern.length ? patternLabel(g.pattern) : 'Henüz ders programı yok'} · {g.defaultDurationMinutes} dk</p>
        </div>
        {!g.isActive && <Badge tone="neutral">Pasif</Badge>}
        {canWrite && (
          <div className="relative">
            <button type="button" onClick={() => setMenu((m) => !m)} aria-label="Grup işlemleri" aria-expanded={menu} className="-mr-1.5 rounded-lg p-1.5 text-panel-muted hover:bg-panel-bg hover:text-espresso">
              <MoreHorizontal className="h-5 w-5" />
            </button>
            {menu && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setMenu(false)} aria-hidden />
                <div role="menu" className="absolute right-0 z-40 mt-1 w-52 overflow-hidden rounded-xl border border-panel-line bg-white py-1.5 shadow-[0_18px_40px_-16px_rgba(33,23,16,0.35)]">
                  <button role="menuitem" type="button" onClick={() => { setMenu(false); onToggle(); }} className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-cocoa hover:bg-panel-bg">
                    <Power className="h-4 w-4" /> {g.isActive ? 'Pasife al' : 'Aktifleştir'}
                  </button>
                  <button role="menuitem" type="button" onClick={() => { setMenu(false); onDelete(); }} className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-danger-ink hover:bg-danger/10">
                    <Trash2 className="h-4 w-4" /> Grubu sil
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
      <div className="flex-1 px-5 py-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[0.72rem] font-semibold tracking-wide text-panel-muted uppercase">Üyeler</p>
          <SeatDots taken={g.members.length} capacity={g.capacity} />
        </div>
        {g.members.length ? (
          <ul className="space-y-1">
            {g.members.map((m) => (
              <li key={m.id}><Link to={`/panel/danisanlar/${m.id}?sekme=pilates`} className="text-sm font-medium text-espresso hover:underline">{clientName(m)}</Link></li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-panel-muted">Üye eklenmedi.</p>
        )}
        {g.note && <p className="mt-3 line-clamp-2 text-[0.8rem] text-panel-muted">{g.note}</p>}
      </div>
      <div className="border-t border-panel-line px-5 py-3">
        {g.nextSession ? (
          <button type="button" onClick={() => onOpenSession(g.nextSession!.id)} className="text-left text-[0.82rem] text-cocoa hover:underline">
            Sonraki ders: <span className="tabular font-semibold text-espresso">{formatDateTime(g.nextSession.startsAt)}</span>
            <span className="text-panel-muted"> · {g.upcomingCount} planlı</span>
          </button>
        ) : (
          <p className="text-[0.82rem] text-panel-muted">Planlı ders yok.</p>
        )}
        {canWrite && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" icon={<Pencil className="h-3.5 w-3.5" />} onClick={onEdit}>Düzenle</Button>
            {g.isActive && <Button size="sm" variant="secondary" icon={<Repeat className="h-3.5 w-3.5" />} onClick={onSchedule}>Ders programı ekle</Button>}
          </div>
        )}
      </div>
    </Card>
  );
}

function GroupsTab({ groups, loading, error, reload, onEdit, onSchedule, onNew, onOpenSession }: {
  groups: ClassGroupDTO[] | undefined;
  loading: boolean;
  error: ApiError | null;
  reload: () => void;
  onEdit: (g: ClassGroupDTO) => void;
  onSchedule: (g: ClassGroupDTO) => void;
  onNew: () => void;
  onOpenSession: (id: string) => void;
}) {
  const fb = useFeedback();
  const { can } = usePanelAuth();
  if (error) return <Card><ErrorState message={error.message} onRetry={reload} /></Card>;
  if (loading && !groups) {
    return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-64 rounded-xl" />)}</div>;
  }
  if (!groups?.length) {
    return (
      <Card>
        <EmptyState
          icon={<Users className="h-5 w-5" />}
          title="Henüz pilates grubu yok."
          description="Sabit saatte birlikte ders alan danışanları bir grupta toplayın (ör. 3 kişilik reformer grubu). Sonra haftalık ders programını tek seferde ekleyin."
          action={can('appointments:write') && <Button icon={<Plus className="h-4 w-4" />} onClick={onNew}>İlk grubu oluştur</Button>}
        />
      </Card>
    );
  }
  const toggle = async (g: ClassGroupDTO) => {
    try {
      await api.patch(`/classes/groups/${g.id}`, { isActive: !g.isActive });
      fb.success(g.isActive ? 'Grup pasife alındı' : 'Grup aktifleştirildi', g.isActive && g.upcomingCount ? `${g.upcomingCount} planlı ders takvimde kalır; gerekirse tek tek iptal edin.` : undefined);
      reload();
    } catch (e) {
      if (e instanceof ApiError) fb.error('Grup güncellenemedi', e.message);
    }
  };
  const remove = async (g: ClassGroupDTO) => {
    const ok = await fb.confirm({ title: `“${g.name}” silinsin mi?`, description: 'Geçmiş dersler ve katılım kayıtları korunur; grup ve üyelik listesi silinir.', confirmLabel: 'Grubu sil', tone: 'danger' });
    if (!ok) return;
    try {
      await api.del(`/classes/groups/${g.id}`);
      fb.success('Grup silindi');
      reload();
    } catch (e) {
      if (e instanceof ApiError) fb.error('Grup silinemedi', e.message);
    }
  };
  const active = groups.filter((g) => g.isActive);
  const passive = groups.filter((g) => !g.isActive);
  const grid = (list: ClassGroupDTO[]) => (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {list.map((g) => (
        <GroupCard key={g.id} g={g} onEdit={() => onEdit(g)} onSchedule={() => onSchedule(g)} onToggle={() => toggle(g)} onDelete={() => remove(g)} onOpenSession={onOpenSession} />
      ))}
    </div>
  );
  return (
    <div className="space-y-8">
      {active.length ? grid(active) : <p className="text-sm text-panel-muted">Aktif grup yok.</p>}
      {passive.length > 0 && (
        <section>
          <h2 className="mb-3 text-[0.8rem] font-semibold tracking-wide text-panel-muted uppercase">Pasif gruplar</h2>
          {grid(passive)}
        </section>
      )}
    </div>
  );
}

// ───────────────────────── Sayfa ─────────────────────────

function Inner() {
  const [params, setParams] = useSearchParams();
  const { can } = usePanelAuth();
  const canWrite = can('appointments:write');
  const tab = (params.get('sekme') as Tab) || 'program';
  const anchor = params.get('d') || todayStr();
  const openId = params.get('ders');
  const [refreshKey, setRefreshKey] = useState(0);
  const [groupModal, setGroupModal] = useState<{ open: boolean; group: ClassGroupDTO | null }>({ open: false, group: null });
  const [scheduleFor, setScheduleFor] = useState<ClassGroupDTO | null>(null);
  const [newSession, setNewSession] = useState<{ date?: string } | null>(null);

  const update = useCallback(
    (patch: Record<string, string | null>) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(patch)) (v === null ? next.delete(k) : next.set(k, v));
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );
  const groups = useApi(() => api.get<{ items: ClassGroupDTO[] }>('/classes/groups'), [refreshKey]);
  const bump = () => setRefreshKey((k) => k + 1);

  return (
    <>
      <PageHeader
        title="Pilates"
        description="Grup derslerini planlayın, kontenjanı ve yoklamayı takip edin. Dersler randevu takviminde de yer kaplar."
        actions={
          canWrite && (
            <>
              <Button variant="secondary" icon={<CalendarPlus className="h-4 w-4" />} onClick={() => setNewSession({})}>Tek ders</Button>
              <Button icon={<Plus className="h-4 w-4" />} onClick={() => setGroupModal({ open: true, group: null })}>Yeni grup</Button>
            </>
          )
        }
      />
      <Tabs<Tab>
        className="mb-6"
        value={tab}
        onChange={(t) => update({ sekme: t })}
        tabs={[
          { value: 'program', label: <span className="flex items-center gap-1.5"><Dumbbell className="h-4 w-4" /> Haftalık program</span> },
          { value: 'gruplar', label: <span className="flex items-center gap-1.5"><Users className="h-4 w-4" /> Gruplar</span>, count: groups.data?.items.filter((g) => g.isActive).length },
        ]}
      />

      {tab === 'program' ? (
        <ProgramTab anchor={anchor} setAnchor={(d) => update({ d })} refreshKey={refreshKey} onOpen={(id) => update({ ders: id })} onNew={(date) => setNewSession({ date })} />
      ) : (
        <GroupsTab
          groups={groups.data?.items}
          loading={groups.loading}
          error={groups.error}
          reload={bump}
          onNew={() => setGroupModal({ open: true, group: null })}
          onEdit={(g) => setGroupModal({ open: true, group: g })}
          onSchedule={setScheduleFor}
          onOpenSession={(id) => update({ ders: id })}
        />
      )}

      <GroupFormModal
        open={groupModal.open}
        group={groupModal.group}
        onClose={() => setGroupModal({ open: false, group: null })}
        onSaved={(g, isNew) => {
          setGroupModal({ open: false, group: null });
          bump();
          if (isNew) {
            update({ sekme: 'gruplar' });
            setScheduleFor(g);
          }
        }}
      />
      <RecurringModal open={!!scheduleFor} group={scheduleFor} onClose={() => setScheduleFor(null)} onDone={bump} />
      <NewSessionModal
        open={!!newSession}
        groups={groups.data?.items ?? []}
        initial={newSession ?? undefined}
        onClose={() => setNewSession(null)}
        onCreated={(s) => {
          bump();
          update({ sekme: 'program', d: s.date });
        }}
      />
      <SessionModal sessionId={openId} open={!!openId} onClose={() => update({ ders: null })} onChanged={bump} />
    </>
  );
}

export default function ClassesPage() {
  return (
    <RequirePermission perm="appointments:read">
      <Inner />
    </RequirePermission>
  );
}
