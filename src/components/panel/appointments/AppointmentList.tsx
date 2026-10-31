/** Liste görünümü: filtreler + tablo (mobilde kart) + sayfalama */
import { useEffect, useState } from 'react';
import { CalendarX2, Check, Eye, Search, SlidersHorizontal, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi, useDebounced } from '@/hooks/useApi';
import { formatDate, formatDayStr, formatPhone, relativeTime } from '@/lib/format';
import { APPOINTMENT_STATUSES, APPOINTMENT_STATUS_LABEL, MEETING_TYPE_LABEL, type AppointmentStatus, type MeetingType } from '@shared/constants';
import { cn } from '@/lib/format';
import { Button, EmptyState, ErrorState, IconButton, Pagination, ResponsiveTable, SkeletonRows, StatusBadge, useFeedback } from '../ui';
import { ApiError } from '@/lib/api';
import { displayName, type AppointmentDTO } from './types';

export interface ListFilters {
  from: string;
  to: string;
  statuses: AppointmentStatus[];
  meetingType: '' | MeetingType;
  q: string;
}

export function AppointmentList({
  filters, setFilters, onOpen, refreshKey, onChanged,
}: {
  filters: ListFilters;
  setFilters: (f: ListFilters) => void;
  onOpen: (id: string) => void;
  refreshKey: number;
  onChanged: () => void;
}) {
  const fb = useFeedback();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState(filters.q);
  const dq = useDebounced(q, 300);
  const [showFilters, setShowFilters] = useState(false);
  useEffect(() => {
    if (dq !== filters.q) setFilters({ ...filters, q: dq });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dq]);
  useEffect(() => setPage(1), [filters.from, filters.to, filters.statuses.join(), filters.meetingType, filters.q]);

  const { data, error, loading, reload } = useApi(
    () =>
      api.get<{ items: AppointmentDTO[]; total: number; page: number; pageSize: number }>('/appointments', {
        from: filters.from || undefined,
        to: filters.to || undefined,
        status: filters.statuses.length ? filters.statuses : undefined,
        meetingType: filters.meetingType || undefined,
        q: filters.q || undefined,
        page,
        pageSize: 25,
        sort: '-startsAt',
      }),
    [filters.from, filters.to, filters.statuses.join(), filters.meetingType, filters.q, page, refreshKey],
  );

  const toggleStatus = (s: AppointmentStatus) =>
    setFilters({ ...filters, statuses: filters.statuses.includes(s) ? filters.statuses.filter((x) => x !== s) : [...filters.statuses, s] });
  const active = !!(filters.from || filters.to || filters.statuses.length || filters.meetingType || filters.q);

  const quickConfirm = async (a: AppointmentDTO) => {
    try {
      await api.post(`/appointments/${a.id}/status`, { status: 'CONFIRMED' });
      fb.success('Randevu onaylandı', `${displayName(a)} · ${a.time}`);
      onChanged();
      void reload();
    } catch (e) {
      fb.error('Onaylanamadı', e instanceof ApiError ? e.message : undefined);
    }
  };

  const when = (a: AppointmentDTO) =>
    a.date ? (
      <span className="tabular">{formatDayStr(a.date, 'd MMM yyyy, ccc')}</span>
    ) : (
      <span className="text-panel-muted">Saat atanmadı</span>
    );

  return (
    <div>
      <div className="space-y-3 border-b border-panel-line p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-panel-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Danışan adı, telefon, e-posta"
              aria-label="Randevularda ara"
              className="h-9 w-full rounded-lg border border-panel-line bg-white pr-3 pl-9 text-sm focus:border-cocoa focus:outline-none"
            />
          </div>
          <Button variant="secondary" size="sm" className="h-9 sm:hidden" icon={<SlidersHorizontal className="h-4 w-4" />} onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters}>
            Filtreler
          </Button>
          <div className={cn('w-full flex-wrap items-center gap-2 sm:flex sm:w-auto', showFilters ? 'flex' : 'hidden')}>
            <label className="flex items-center gap-1.5 text-[0.8rem] text-panel-muted">
              <span>Başlangıç</span>
              <input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} className="h-9 rounded-lg border border-panel-line bg-white px-2 text-sm text-espresso tabular" />
            </label>
            <label className="flex items-center gap-1.5 text-[0.8rem] text-panel-muted">
              <span>Bitiş</span>
              <input type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => setFilters({ ...filters, to: e.target.value })} className="h-9 rounded-lg border border-panel-line bg-white px-2 text-sm text-espresso tabular" />
            </label>
            <select
              value={filters.meetingType}
              onChange={(e) => setFilters({ ...filters, meetingType: e.target.value as ListFilters['meetingType'] })}
              aria-label="Görüşme türü"
              className="h-9 rounded-lg border border-panel-line bg-white px-2 text-sm"
            >
              <option value="">Tüm görüşme türleri</option>
              <option value="IN_PERSON">{MEETING_TYPE_LABEL.IN_PERSON}</option>
              <option value="ONLINE">{MEETING_TYPE_LABEL.ONLINE}</option>
            </select>
          </div>
        </div>
        <div className={cn('flex-wrap items-center gap-1.5 sm:flex', showFilters ? 'flex' : 'hidden')} role="group" aria-label="Durum filtresi">
          {APPOINTMENT_STATUSES.map((s) => {
            const on = filters.statuses.includes(s);
            return (
              <button
                key={s}
                type="button"
                aria-pressed={on}
                onClick={() => toggleStatus(s)}
                className={cn('rounded-full px-3 py-1 text-[0.78rem] font-semibold ring-1 ring-inset transition-colors', on ? 'bg-cocoa text-ivory ring-cocoa' : 'bg-white text-cocoa ring-panel-line hover:ring-cocoa/40')}
              >
                {APPOINTMENT_STATUS_LABEL[s]}
              </button>
            );
          })}
          {active && (
            <button type="button" onClick={() => { setQ(''); setFilters({ from: '', to: '', statuses: [], meetingType: '', q: '' }); }} className="ml-1 inline-flex items-center gap-1 text-[0.78rem] font-semibold text-panel-muted hover:text-cocoa">
              <X className="h-3.5 w-3.5" /> Filtreleri temizle
            </button>
          )}
        </div>
      </div>

      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : loading && !data ? (
        <SkeletonRows rows={6} />
      ) : !data?.items.length ? (
        <EmptyState
          icon={<CalendarX2 className="h-5 w-5" />}
          title={active ? 'Bu filtrelerle eşleşen randevu yok' : 'Henüz randevunuz bulunmuyor.'}
          description={active ? 'Filtreleri genişletmeyi veya temizlemeyi deneyin.' : 'Web sitesinden gelen talepler ve panelden oluşturduğunuz randevular burada listelenir.'}
        />
      ) : (
        <div className={cn(loading && 'opacity-60 transition-opacity')}>
          <ResponsiveTable
            rows={data.items}
            rowKey={(a) => a.id}
            onRowClick={(a) => onOpen(a.id)}
            columns={[
              {
                key: 'client',
                header: 'Danışan',
                cell: (a) => (
                  <div className="min-w-0">
                    <p className="font-semibold text-espresso">{displayName(a)}</p>
                    <p className="text-[0.78rem] text-panel-muted tabular">{formatPhone(a.contactPhone)}</p>
                  </div>
                ),
              },
              { key: 'date', header: 'Tarih', cell: when },
              { key: 'time', header: 'Saat', cell: (a) => <span className="tabular">{a.time ? `${a.time}` : '—'}</span> },
              { key: 'type', header: 'Görüşme türü', cell: (a) => MEETING_TYPE_LABEL[a.meetingType] },
              { key: 'status', header: 'Durum', cell: (a) => <StatusBadge status={a.status} /> },
              { key: 'created', header: 'Oluşturulma', cell: (a) => <span className="text-panel-muted tabular" title={formatDate(a.createdAt)}>{relativeTime(a.createdAt)}</span> },
              {
                key: 'actions',
                header: <span className="sr-only">İşlemler</span>,
                className: 'text-right',
                cell: (a) => (
                  <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    {(a.status === 'PENDING' || (a.status === 'NEW_REQUEST' && a.date)) && (
                      <IconButton label="Onayla" onClick={() => void quickConfirm(a)} className="text-success hover:bg-success/10 hover:text-success">
                        <Check className="h-4 w-4" />
                      </IconButton>
                    )}
                    <IconButton label="Detay" onClick={() => onOpen(a.id)}><Eye className="h-4 w-4" /></IconButton>
                  </div>
                ),
              },
            ]}
            mobileCard={(a) => (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-espresso">{displayName(a)}</p>
                  <p className="mt-0.5 text-[0.8rem] text-panel-muted">
                    {a.date ? <span className="tabular">{formatDayStr(a.date, 'd MMM, ccc')} · {a.time}</span> : 'Saat atanmadı'} · {MEETING_TYPE_LABEL[a.meetingType]}
                  </p>
                </div>
                <StatusBadge status={a.status} />
              </div>
            )}
          />
          <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onChange={setPage} />
        </div>
      )}
    </div>
  );
}
