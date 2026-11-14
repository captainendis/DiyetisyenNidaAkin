// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

'use client';

import { useEffect } from 'react';
import { Link } from '@/lib/router';
import { portalApi } from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import { formatDate, formatTime } from '@/lib/format';
import { APPOINTMENT_STATUS_LABEL, MEETING_TYPE_LABEL } from '@shared/constants';
import type { PortalAppointment } from '@shared/portal';
import { Empty, LoadError, Loading, PortalPageHeader } from '@/components/portal/ui';
import { cn } from '@/lib/text';

const TONE: Partial<Record<PortalAppointment['status'], string>> = {
  CONFIRMED: 'bg-success/12 text-success-ink',
  PENDING: 'bg-warning/15 text-warning-ink',
  COMPLETED: 'bg-espresso/[0.07] text-cocoa',
  CANCELLED: 'bg-danger/10 text-danger-ink',
  NO_SHOW: 'bg-danger/10 text-danger-ink',
};

function Row({ a }: { a: PortalAppointment }) {
  return (
    <li className="flex items-center justify-between gap-4 rounded-lg bg-white px-5 py-4 ring-1 ring-espresso/[0.07]">
      <div className="min-w-0">
        <p className="font-display nums text-[1.4rem] leading-tight">{a.startsAt && formatDate(a.startsAt)}</p>
        <p className="mt-0.5 text-[0.92rem] text-cocoa">
          <span className="font-semibold tabular-nums">{a.startsAt && formatTime(a.startsAt)}</span> · {MEETING_TYPE_LABEL[a.meetingType]}
          {a.service && <span className="text-taupe"> · {a.service}</span>}
        </p>
      </div>
      <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-[0.78rem] font-semibold', TONE[a.status] ?? 'bg-espresso/[0.07] text-cocoa')}>{APPOINTMENT_STATUS_LABEL[a.status]}</span>
    </li>
  );
}

export default function PortalAppointmentsPage() {
  const { data, error, loading, reload } = useApi(() => portalApi.get<{ items: PortalAppointment[] }>('/appointments'), []);
  useEffect(() => {
    document.title = 'Randevularım | Nida Akın';
  }, []);
  const now = Date.now();
  const upcoming = (data?.items ?? []).filter((a) => a.startsAt && new Date(a.startsAt).getTime() > now && a.status !== 'CANCELLED').reverse();
  const past = (data?.items ?? []).filter((a) => !upcoming.includes(a));

  return (
    <>
      <PortalPageHeader
        title="Randevular"
        lead={<>Randevunu değiştirmek ya da iptal etmek için diyetisyeninle iletişime geç. Yeni görüşme için <Link to="/randevu" className="font-semibold text-espresso underline underline-offset-4">randevu talep et</Link>.</>}
      />
      {loading && !data ? (
        <Loading />
      ) : error ? (
        <LoadError message={error.message} onRetry={reload} />
      ) : !data?.items.length ? (
        <Empty title="Henüz randevun yok.">İlk görüşmen için <Link to="/randevu" className="font-semibold text-espresso underline underline-offset-4">randevu talep et</Link>; onaylanınca burada görünür.</Empty>
      ) : (
        <div className="space-y-10">
          {upcoming.length > 0 && (
            <section aria-labelledby="yaklasan">
              <h2 id="yaklasan" className="mb-3 text-[0.92rem] font-semibold text-taupe">Yaklaşan</h2>
              <ul className="space-y-3">{upcoming.map((a) => <Row key={a.id} a={a} />)}</ul>
            </section>
          )}
          {past.length > 0 && (
            <section aria-labelledby="gecmis">
              <h2 id="gecmis" className="mb-3 text-[0.92rem] font-semibold text-taupe">Geçmiş görüşmeler</h2>
              <ul className="space-y-3">{past.map((a) => <Row key={a.id} a={a} />)}</ul>
            </section>
          )}
        </div>
      )}
    </>
  );
}
