import { Link, useNavigate } from 'react-router';
import { CalendarPlus, CalendarX2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import { formatDateLong, formatTime } from '@/lib/format';
import { MEETING_TYPE_LABEL } from '@shared/constants';
import { Button, Card, EmptyState, ErrorState, ResponsiveTable, SkeletonRows, StatusBadge } from '@/components/panel/ui';
import type { ClientAppointment } from './types';

export function AppointmentsTab({ clientId }: { clientId: string }) {
  const navigate = useNavigate();
  const { data, error, loading, reload } = useApi(() => api.get<{ items: ClientAppointment[] }>(`/clients/${clientId}/appointments`), [clientId]);
  const now = Date.now();
  const upcoming = data?.items.filter((a) => a.startsAt && new Date(a.startsAt).getTime() >= now).reverse() ?? [];
  const past = data?.items.filter((a) => !a.startsAt || new Date(a.startsAt).getTime() < now) ?? [];
  const open = (a: ClientAppointment) => navigate(`/panel/randevular?id=${a.id}`);

  if (loading) return <Card><SkeletonRows rows={4} /></Card>;
  if (error) return <Card><ErrorState message={error.message} onRetry={reload} /></Card>;
  if (!data?.items.length) {
    return (
      <Card>
        <EmptyState
          icon={<CalendarX2 className="h-5 w-5" />}
          title="Henüz randevu bulunmuyor."
          description="Bu danışan için oluşturulan randevular burada görünür."
          action={<Link to={`/panel/randevular?new=1&clientId=${clientId}`}><Button icon={<CalendarPlus className="h-4 w-4" />}>Randevu oluştur</Button></Link>}
        />
      </Card>
    );
  }

  const table = (rows: ClientAppointment[]) => (
    <ResponsiveTable
      rows={rows}
      rowKey={(r) => r.id}
      onRowClick={open}
      columns={[
        { key: 'date', header: 'Tarih', cell: (r) => <span className="font-semibold text-espresso">{r.startsAt ? formatDateLong(r.startsAt) : 'Saat belirlenmedi'}</span> },
        { key: 'time', header: 'Saat', cell: (r) => <span className="tabular text-cocoa">{r.startsAt ? `${formatTime(r.startsAt)}–${r.endsAt ? formatTime(r.endsAt) : ''}` : '—'}</span> },
        { key: 'type', header: 'Görüşme türü', cell: (r) => <span className="text-cocoa">{MEETING_TYPE_LABEL[r.meetingType]}</span> },
        { key: 'service', header: 'Hizmet', cell: (r) => <span className="text-cocoa">{r.service?.title ?? <span className="text-panel-muted">—</span>}</span> },
        { key: 'status', header: 'Durum', cell: (r) => <StatusBadge status={r.status} /> },
      ]}
      mobileCard={(r) => (
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-espresso">{r.startsAt ? formatDateLong(r.startsAt) : 'Saat belirlenmedi'}</p>
            <p className="tabular mt-0.5 text-sm text-cocoa">{r.startsAt ? formatTime(r.startsAt) : ''} · {MEETING_TYPE_LABEL[r.meetingType]}</p>
          </div>
          <StatusBadge status={r.status} />
        </div>
      )}
    />
  );

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="text-[0.95rem] font-bold text-espresso">Gelecek randevular</h2>
          <Link to={`/panel/randevular?new=1&clientId=${clientId}`}><Button size="sm" variant="secondary" icon={<CalendarPlus className="h-4 w-4" />}>Yeni randevu</Button></Link>
        </div>
        {upcoming.length ? table(upcoming) : <p className="px-5 pb-5 text-sm text-panel-muted">Planlanmış bir randevu yok.</p>}
      </Card>
      <Card>
        <h2 className="px-5 pt-5 pb-3 text-[0.95rem] font-bold text-espresso">Geçmiş randevular <span className="tabular font-normal text-panel-muted">({past.length})</span></h2>
        {past.length ? table(past) : <p className="px-5 pb-5 text-sm text-panel-muted">Geçmiş randevu yok.</p>}
      </Card>
    </div>
  );
}
