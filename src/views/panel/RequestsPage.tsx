// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

'use client';

/**
 * /panel/talepler — talepler ve müsaitlik
 *  - Solda: yanıt bekleyen diyet ve pilates talepleri (yeni talep + onay bekleyen), türe göre süzülür
 *  - Sağda: önümüzdeki 14 gün diyet görüşmesi boş saatleri ve pilates grup/ders boş yerleri
 * Talebe tıklayınca randevu detayı açılır (saat atama, onay, iptal orada).
 * URL parametreleri: tur (diyet | pilates), id (detay modalı)
 */
import { useCallback, useMemo } from 'react';
import { DateTime } from 'luxon';
import { Inbox } from 'lucide-react';
import { Link, useSearchParams } from '@/lib/router';
import { api } from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import { cn, formatDayStr, formatPhone, relativeTime, todayStr } from '@/lib/format';
import { PILATES_FORMAT_LABEL, TIME_ZONE, pilatesPreferenceText, type AppointmentKind } from '@shared/constants';
import type { ClassGroupDTO, ClassSessionDTO } from '@shared/classes';
import { RequirePermission, usePanelAuth } from '@/components/panel/PanelAuth';
import { Card, EmptyState, ErrorState, PageHeader, Skeleton, SkeletonRows, StatusBadge, Tabs } from '@/components/panel/ui';
import AppointmentDetailModal from '@/components/panel/appointments/AppointmentDetailModal';
import { displayName, type AppointmentDTO } from '@/components/panel/appointments/types';

type Tab = 'tumu' | 'diyet' | 'pilates';
const TAB_KIND: Record<Tab, AppointmentKind | undefined> = { tumu: undefined, diyet: 'CONSULTATION', pilates: 'PILATES' };
const DAYS_AHEAD = 14;

function RequestRow({ a, onOpen }: { a: AppointmentDTO; onOpen: () => void }) {
  const pilates = a.kind === 'PILATES';
  return (
    <li>
      <button type="button" onClick={onOpen} className="flex w-full flex-col gap-1.5 px-4 py-3.5 text-left transition-colors hover:bg-panel-bg/70 sm:flex-row sm:items-center sm:gap-5 sm:px-5">
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-espresso">{displayName(a)}</span>
          <span className="tabular block text-[0.78rem] text-panel-muted">{formatPhone(a.contactPhone)} · {relativeTime(a.createdAt)}</span>
        </span>
        <span className="min-w-0 sm:w-64">
          <span className="block text-sm font-semibold text-cocoa">
            {pilates ? `Pilates · ${a.pilatesFormat ? PILATES_FORMAT_LABEL[a.pilatesFormat] : 'ders'}` : `Diyet${a.service ? ` · ${a.service.title}` : ''}`}
          </span>
          <span className="block truncate text-[0.8rem] text-panel-muted">
            {a.date ? <span className="tabular">İstenen: {formatDayStr(a.date, 'd MMM ccc')} {a.time}</span> : pilates ? pilatesPreferenceText(a.preferredDays, a.preferredDayparts) : 'Saat seçilmedi, geri arama'}
          </span>
        </span>
        <span className="shrink-0"><StatusBadge status={a.status} /></span>
      </button>
    </li>
  );
}

/** Diyet görüşmesi: ziyaretçinin çevrim içi formda görebileceği boş saat sayıları */
function ConsultationAvailability() {
  const from = todayStr();
  const to = DateTime.fromISO(from, { zone: TIME_ZONE }).plus({ days: DAYS_AHEAD - 1 }).toISODate()!;
  const { data, error, loading } = useApi(() => api.get<{ days: { date: string; available: number }[] }>('/public/availability/days', { from, to }), [from]);
  const max = Math.max(1, ...(data?.days.map((d) => d.available) ?? [1]));
  const total = data?.days.reduce((s, d) => s + d.available, 0) ?? 0;
  return (
    <Card className="overflow-hidden">
      <header className="flex items-baseline justify-between gap-3 border-b border-panel-line px-5 py-3.5">
        <h2 className="text-[0.95rem] font-bold text-espresso">Diyet görüşmesi</h2>
        {data && <span className="tabular text-[0.78rem] text-panel-muted">{total} boş saat · {DAYS_AHEAD} gün</span>}
      </header>
      {error ? (
        <p className="px-5 py-4 text-sm text-panel-muted">Müsaitlik yüklenemedi.</p>
      ) : loading && !data ? (
        <div className="p-5"><Skeleton className="h-48 w-full" /></div>
      ) : (
        <ul className="divide-y divide-panel-line/70">
          {data!.days.map((d) => (
            <li key={d.date}>
              <Link to={`/panel/randevular?view=day&d=${d.date}`} className="flex items-center gap-3 px-5 py-2 text-sm hover:bg-panel-bg/70">
                <span className="w-28 shrink-0 text-espresso capitalize">{formatDayStr(d.date, 'd MMM ccc')}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel-line/70" aria-hidden>
                  <span className={cn('block h-full rounded-full', d.available ? 'bg-success' : 'bg-transparent')} style={{ width: `${(d.available / max) * 100}%` }} />
                </span>
                <span className={cn('tabular w-14 shrink-0 text-right text-[0.8rem]', d.available ? 'font-semibold text-espresso' : 'text-panel-muted')}>
                  {d.available ? `${d.available} saat` : 'dolu'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="border-t border-panel-line px-5 py-2.5 text-[0.75rem] text-panel-muted">Web sitesindeki randevu formunda görünen saatler. Çalışma saatleri <Link to="/panel/ayarlar/takvim" className="underline underline-offset-2">Çalışma Takvimi</Link>’nden değişir.</p>
    </Card>
  );
}

/** Pilates: üye kontenjanı boş gruplar ve önümüzdeki derslerdeki boş yerler */
function PilatesAvailability() {
  const from = todayStr();
  const to = DateTime.fromISO(from, { zone: TIME_ZONE }).plus({ days: DAYS_AHEAD - 1 }).toISODate()!;
  const data = useApi(async () => {
    const [groups, sessions] = await Promise.all([
      api.get<{ items: ClassGroupDTO[] }>('/classes/groups'),
      api.get<{ items: ClassSessionDTO[] }>('/classes/sessions', { from, to }),
    ]);
    return { groups: groups.items.filter((g) => g.isActive), sessions: sessions.items.filter((s) => s.status === 'SCHEDULED' && new Date(s.startsAt).getTime() > Date.now()) };
  }, [from]);
  const openSessions = (data.data?.sessions ?? []).filter((s) => s.seatsTaken < s.capacity);
  return (
    <Card className="overflow-hidden">
      <header className="flex items-baseline justify-between gap-3 border-b border-panel-line px-5 py-3.5">
        <h2 className="text-[0.95rem] font-bold text-espresso">Pilates</h2>
        <Link to="/panel/pilates" className="text-[0.78rem] font-semibold text-cocoa hover:underline">Gruplar</Link>
      </header>
      {data.error ? (
        <p className="px-5 py-4 text-sm text-panel-muted">Müsaitlik yüklenemedi.</p>
      ) : data.loading && !data.data ? (
        <div className="p-5"><Skeleton className="h-32 w-full" /></div>
      ) : (
        <div className="divide-y divide-panel-line">
          <section className="px-5 py-3.5">
            <h3 className="mb-2 text-[0.78rem] font-semibold text-panel-muted">Grup kontenjanı</h3>
            {data.data!.groups.length ? (
              <ul className="space-y-1.5">
                {data.data!.groups.map((g) => {
                  const free = g.capacity - g.members.length;
                  return (
                    <li key={g.id} className="flex items-baseline justify-between gap-3 text-sm">
                      <Link to={`/panel/pilates?grup=${g.id}`} className="min-w-0 truncate text-espresso hover:underline">{g.name}</Link>
                      <span className={cn('tabular shrink-0 text-[0.8rem]', free > 0 ? 'font-semibold text-success-ink' : 'text-panel-muted')}>{free > 0 ? `${free} boş yer` : 'dolu'}</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-panel-muted">Aktif grup yok.</p>
            )}
          </section>
          <section className="px-5 py-3.5">
            <h3 className="mb-2 text-[0.78rem] font-semibold text-panel-muted">Boş yeri olan dersler ({DAYS_AHEAD} gün)</h3>
            {openSessions.length ? (
              <ul className="space-y-1.5">
                {openSessions.slice(0, 12).map((s) => (
                  <li key={s.id}>
                    <Link to={`/panel/randevular?view=week&d=${s.date}&ders=${s.id}`} className="flex items-baseline justify-between gap-3 text-sm hover:underline">
                      <span className="min-w-0 truncate text-espresso"><span className="tabular capitalize">{formatDayStr(s.date, 'd MMM ccc')} {s.time}</span> · {s.groupName ?? s.title}</span>
                      <span className="tabular shrink-0 text-[0.8rem] font-semibold text-success-ink">{s.capacity - s.seatsTaken} yer</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-panel-muted">Önümüzdeki derslerde boş yer yok.</p>
            )}
          </section>
        </div>
      )}
    </Card>
  );
}

function Inner() {
  const [params, setParams] = useSearchParams();
  const { refreshUnread } = usePanelAuth();
  const tab = (['tumu', 'diyet', 'pilates'] as Tab[]).find((t) => t === params.get('tur')) ?? 'tumu';
  const openId = params.get('id');
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
  const list = useApi(
    () => api.get<{ items: AppointmentDTO[]; total: number }>('/appointments', { status: ['NEW_REQUEST', 'PENDING'], pageSize: 200, sort: '-createdAt' }),
    [],
  );
  const counts = useMemo(() => {
    const items = list.data?.items ?? [];
    return { tumu: items.length, diyet: items.filter((a) => a.kind === 'CONSULTATION').length, pilates: items.filter((a) => a.kind === 'PILATES').length };
  }, [list.data]);
  const kind = TAB_KIND[tab];
  const items = (list.data?.items ?? []).filter((a) => !kind || a.kind === kind);

  return (
    <>
      <PageHeader title="Talepler ve müsaitlik" description="Yanıt bekleyen diyet ve pilates talepleri; yanında önümüzdeki iki haftanın boş saatleri ve pilates kontenjanı. Talebe tıklayarak saat atayın ve onaylayın." />
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Card className="overflow-hidden">
          <div className="px-4 pt-3 sm:px-5">
            <Tabs<Tab>
              value={tab}
              onChange={(t) => update({ tur: t === 'tumu' ? null : t })}
              tabs={[
                { value: 'tumu', label: 'Tümü', count: counts.tumu },
                { value: 'diyet', label: 'Diyet', count: counts.diyet },
                { value: 'pilates', label: 'Pilates', count: counts.pilates },
              ]}
            />
          </div>
          {list.error ? (
            <ErrorState message={list.error.message} onRetry={list.reload} />
          ) : list.loading && !list.data ? (
            <SkeletonRows rows={5} />
          ) : items.length ? (
            <ul className="divide-y divide-panel-line">{items.map((a) => <RequestRow key={a.id} a={a} onOpen={() => update({ id: a.id })} />)}</ul>
          ) : (
            <EmptyState icon={<Inbox className="h-5 w-5" />} title="Yanıt bekleyen talep yok." description="Web sitesinden ve danışan hesaplarından gelen yeni talepler burada listelenir." />
          )}
        </Card>
        <div className="space-y-5">
          <ConsultationAvailability />
          <PilatesAvailability />
        </div>
      </div>
      <AppointmentDetailModal
        appointmentId={openId}
        open={!!openId}
        onClose={() => update({ id: null })}
        onChanged={() => {
          list.reload();
          refreshUnread();
        }}
      />
    </>
  );
}

export default function RequestsPage() {
  return (
    <RequirePermission perm="appointments:read">
      <Inner />
    </RequirePermission>
  );
}
