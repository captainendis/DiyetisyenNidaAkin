// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Danışan → Pilates: grup üyelikleri, yaklaşan dersler, katılım geçmişi ve özet */
import { Link } from '@/lib/router';
import { Dumbbell } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import { formatDayStr } from '@/lib/format';
import { Badge, Button, Card, EmptyState, ErrorState, SkeletonRows } from '@/components/panel/ui';
import { AttendanceBadge, SessionStatusBadge, type ClientClassSummary } from '@/components/panel/classes/shared';

type Row = ClientClassSummary['upcoming'][number];

function SessionList({ rows, past }: { rows: Row[]; past?: boolean }) {
  return (
    <ul className="divide-y divide-panel-line">
      {rows.map((s) => (
        <li key={s.id}>
          <Link to={`/panel/randevular?view=week&d=${s.date}&ders=${s.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-panel-bg/60">
            <span className="tabular w-44 shrink-0 font-semibold text-espresso capitalize">{formatDayStr(s.date, 'd MMM, ccc')} · {s.time}</span>
            <span className="min-w-0 flex-1 truncate text-sm text-cocoa">{s.title}</span>
            {past && s.status !== 'COMPLETED' ? <SessionStatusBadge status={s.status} /> : <AttendanceBadge status={s.myStatus} />}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function ClassesTab({ clientId }: { clientId: string }) {
  const { data, error, loading, reload } = useApi(() => api.get<ClientClassSummary>(`/classes/clients/${clientId}`), [clientId]);
  if (loading && !data) return <Card><SkeletonRows rows={3} /></Card>;
  if (error || !data) return <Card><ErrorState message={error?.message} onRetry={reload} /></Card>;
  if (!data.groups.length && !data.upcoming.length && !data.past.length) {
    return (
      <Card>
        <EmptyState
          icon={<Dumbbell className="h-5 w-5" />}
          title="Pilates kaydı yok."
          description="Danışanı bir pilates grubuna ekleyin ya da tek bir derse telafi/misafir olarak kaydedin."
          action={<Link to="/panel/pilates?sekme=gruplar"><Button variant="secondary">Pilates gruplarına git</Button></Link>}
        />
      </Card>
    );
  }
  const { stats } = data;
  const done = stats.attended + stats.noShow;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="px-5 py-4">
          <p className="text-[0.72rem] font-semibold tracking-wide text-panel-muted uppercase">Grup</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {data.groups.length ? data.groups.map((g) => <Badge key={g.id} tone={g.isActive ? 'info' : 'neutral'}>{g.name}</Badge>) : <span className="text-sm text-panel-muted">Grupta değil</span>}
          </div>
        </Card>
        <Card className="px-5 py-4">
          <p className="text-[0.72rem] font-semibold tracking-wide text-panel-muted uppercase">Katıldığı ders</p>
          <p className="tabular mt-1 font-display text-[2rem] leading-none text-espresso">{stats.attended}</p>
          {done > 0 && <p className="tabular mt-1 text-[0.78rem] text-panel-muted">Devam oranı %{Math.round((stats.attended / done) * 100)}</p>}
        </Card>
        <Card className="px-5 py-4">
          <p className="text-[0.72rem] font-semibold tracking-wide text-panel-muted uppercase">Gelmedi / haber verdi</p>
          <p className="tabular mt-1 font-display text-[2rem] leading-none text-espresso">{stats.noShow} <span className="text-panel-muted">/</span> {stats.excused}</p>
        </Card>
      </div>
      <Card>
        <h2 className="px-5 pt-5 pb-3 text-[0.95rem] font-bold text-espresso">Yaklaşan dersler <span className="tabular font-normal text-panel-muted">({data.upcoming.length})</span></h2>
        {data.upcoming.length ? <SessionList rows={data.upcoming} /> : <p className="px-5 pb-5 text-sm text-panel-muted">Planlı ders yok.</p>}
      </Card>
      <Card>
        <h2 className="px-5 pt-5 pb-3 text-[0.95rem] font-bold text-espresso">Geçmiş dersler</h2>
        {data.past.length ? <SessionList rows={data.past} past /> : <p className="px-5 pb-5 text-sm text-panel-muted">Henüz geçmiş ders yok.</p>}
      </Card>
    </div>
  );
}
