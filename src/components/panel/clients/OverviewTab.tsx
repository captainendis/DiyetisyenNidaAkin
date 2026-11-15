// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import { Link } from '@/lib/router';
import { formatDate, formatDayStr, formatPhone, formatTime } from '@/lib/format';
import { CLIENT_SEX_LABEL, MEETING_TYPE_LABEL } from '@shared/constants';
import { Card, CardHeader, StatusBadge } from '@/components/panel/ui';
import { ConsentPanel } from './ConsentPanel';
import { PortalAccountCard } from './PortalAccountCard';
import { usePanelAuth } from '@/components/panel/PanelAuth';
import type { Client, ClientStats } from './types';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-3 py-3 text-sm sm:grid-cols-[11rem_1fr]">
      <dt className="text-panel-muted">{label}</dt>
      <dd className="min-w-0 break-words text-espresso">{children}</dd>
    </div>
  );
}
const none = <span className="text-panel-muted">—</span>;

export function OverviewTab({ client, stats, onClientChanged }: { client: Client; stats: ClientStats; onClientChanged: (c: Client) => void }) {
  const { can } = usePanelAuth();
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
      <div className="space-y-6">
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-panel-line bg-panel-line sm:grid-cols-4">
          {[
            { label: 'Toplam görüşme', value: <span className="tabular">{stats.totalVisits}</span>, hint: 'Tamamlanan' },
            { label: 'Son görüşme', value: stats.lastVisitAt ? formatDate(stats.lastVisitAt) : 'Henüz yok' },
            {
              label: 'Gelecek randevu',
              value: stats.nextAppointment ? (
                <Link to={`/panel/randevular?id=${stats.nextAppointment.id}`} className="underline decoration-gold/50 underline-offset-4 hover:decoration-cocoa">
                  {formatDate(stats.nextAppointment.startsAt)}
                  <span className="block text-sm font-medium text-cocoa">{formatTime(stats.nextAppointment.startsAt)}</span>
                </Link>
              ) : 'Planlanmadı',
              extra: stats.nextAppointment && <StatusBadge status={stats.nextAppointment.status} />,
            },
            { label: 'İlk kayıt', value: formatDate(client.createdAt) },
          ].map((s) => (
            <div key={s.label} className="bg-white p-4">
              <dt className="text-[0.72rem] font-semibold tracking-wide text-panel-muted uppercase">{s.label}</dt>
              <dd className="mt-1.5 text-[1.05rem] font-semibold text-espresso">{s.value}</dd>
              {s.extra && <dd className="mt-1.5">{s.extra}</dd>}
              {s.hint && <dd className="mt-0.5 text-[0.72rem] text-panel-muted">{s.hint}</dd>}
            </div>
          ))}
        </dl>
        <Card>
          <CardHeader title="Danışan bilgileri" />
          <dl className="divide-y divide-panel-line px-5 pb-2">
            <Row label="Telefon"><a href={`tel:${client.phone}`} className="tabular hover:underline">{formatPhone(client.phone)}</a></Row>
            <Row label="E-posta">{client.email ? <a href={`mailto:${client.email}`} className="hover:underline">{client.email}</a> : none}</Row>
            <Row label="Doğum tarihi">{client.birthDate ? formatDayStr(client.birthDate) : none}</Row>
            <Row label="Cinsiyet">{client.sex ? CLIENT_SEX_LABEL[client.sex] : none}</Row>
            <Row label="İlk görüşme tarihi">{client.firstVisitDate ? formatDayStr(client.firstVisitDate) : stats.firstAppointmentAt ? formatDate(stats.firstAppointmentAt) : none}</Row>
            <Row label="Görüşme tercihi">{client.preferredMeetingType ? MEETING_TYPE_LABEL[client.preferredMeetingType] : none}</Row>
            <Row label="Kayıt kaynağı">{client.source === 'WEBSITE' ? 'Web sitesi randevu talebi' : 'Panelden eklendi'}</Row>
            <Row label="Dahili not">{client.internalNote ? <span className="whitespace-pre-wrap">{client.internalNote}</span> : none}</Row>
          </dl>
        </Card>
      </div>
      <div className="space-y-6">
        <ConsentPanel client={client} onChanged={onClientChanged} />
        {can('portal:manage') && <PortalAccountCard client={client} />}
      </div>
    </div>
  );
}
