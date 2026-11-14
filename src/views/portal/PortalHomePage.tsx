// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

'use client';

/** /hesabim — güncel liste (öğün saatleriyle), sıradaki görüşme, son mesaj, kilo durumu */
import { useEffect } from 'react';
import { Link } from '@/lib/router';
import { portalApi } from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import { formatDate, formatDateLong, formatDayStr, formatTime } from '@/lib/format';
import { MEETING_TYPE_LABEL } from '@shared/constants';
import type { PortalOverview, PortalPlan } from '@shared/portal';
import { usePortalAuth } from '@/components/portal/PortalAuth';
import { PlanTimeline } from '@/components/portal/PlanTimeline';
import { LoadError, Loading, Panel, PanelTitle, PortalLinkButton } from '@/components/portal/ui';

const kg = (v: number) => `${v.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} kg`;

export default function PortalHomePage() {
  const { me } = usePortalAuth();
  const { data, error, loading, reload } = useApi(() => portalApi.get<PortalOverview>('/overview'), []);
  const planId = data?.latestPlan?.id;
  const plan = useApi(() => (planId ? portalApi.get<{ plan: PortalPlan }>(`/plans/${planId}`) : Promise.resolve(null)), [planId]);

  useEffect(() => {
    document.title = 'Hesabım | Nida Akın';
  }, []);

  if (loading && !data) return <Loading rows={4} />;
  if (error || !data) return <LoadError message={error?.message} onRetry={reload} />;

  const w = data.weight;
  const change = w.current != null && w.first != null ? Math.round((w.current - w.first) * 10) / 10 : null;

  return (
    <>
      <header className="mb-8 sm:mb-10">
        <p className="text-[0.92rem] text-taupe">{formatDateLong(new Date())}</p>
        <h1 className="mt-1 font-display text-[2.6rem] leading-[1.02] font-medium sm:text-[3.2rem]">Merhaba {me?.firstName}.</h1>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Panel className="sm:p-7">
          {data.latestPlan ? (
            <>
              <PanelTitle action={<Link to="/hesabim/listeler" className="text-[0.88rem] font-medium text-taupe hover:text-espresso">Tüm listeler</Link>}>Güncel listen</PanelTitle>
              <h2 className="font-display nums text-[1.9rem] leading-tight font-medium">{data.latestPlan.name}</h2>
              <p className="mt-1 text-[0.9rem] text-taupe">{formatDate(data.latestPlan.createdAt)} tarihinde verildi</p>
              <div className="mt-6">
                {plan.data?.plan ? <PlanTimeline data={plan.data.plan.data} compact /> : <div className="h-40 animate-pulse rounded-xl bg-espresso/[0.05]" />}
              </div>
              <div className="mt-7 flex flex-wrap gap-2">
                <PortalLinkButton to={`/hesabim/listeler/${data.latestPlan.id}`} className="bg-espresso text-ivory ring-0 hover:bg-cocoa">Listeyi aç</PortalLinkButton>
                <a href={portalApi.url(`/plans/${data.latestPlan.id}/print`, { autoprint: 1 })} target="_blank" rel="noopener" className="inline-flex h-11 items-center rounded-full px-5 text-[0.92rem] font-semibold text-espresso ring-1 ring-espresso/20 ring-inset hover:bg-espresso/[0.05]">Yazdır / PDF</a>
              </div>
            </>
          ) : (
            <>
              <PanelTitle>Güncel listen</PanelTitle>
              <p className="text-[1rem] leading-relaxed text-cocoa">Henüz sana verilmiş bir beslenme listesi yok. Görüşmeden sonra listen burada görünecek.</p>
            </>
          )}
        </Panel>

        <div className="space-y-6">
          <Panel>
            <PanelTitle>Sıradaki görüşme</PanelTitle>
            {data.nextAppointment?.startsAt ? (
              <>
                <p className="font-display nums text-[1.6rem] leading-tight">{formatDate(data.nextAppointment.startsAt)}</p>
                <p className="mt-1 text-[1rem] font-semibold tabular-nums">{formatTime(data.nextAppointment.startsAt)}</p>
                <p className="mt-2 text-[0.9rem] text-taupe">
                  {MEETING_TYPE_LABEL[data.nextAppointment.meetingType]}
                  {data.nextAppointment.status === 'PENDING' && ' · onay bekliyor'}
                </p>
              </>
            ) : (
              <p className="text-[0.95rem] leading-relaxed text-cocoa">
                Planlanmış bir görüşmen yok. <Link to="/randevu" className="font-semibold text-espresso underline underline-offset-4">Randevu talep et</Link>
              </p>
            )}
          </Panel>

          {(w.current != null || w.target != null) && (
            <Panel>
              <PanelTitle action={<Link to="/hesabim/olcumler" className="text-[0.88rem] font-medium text-taupe hover:text-espresso">Ayrıntı</Link>}>Kilo</PanelTitle>
              {w.current != null && <p className="font-display nums text-[2rem] leading-none">{kg(w.current)}</p>}
              <dl className="mt-3 space-y-1 text-[0.92rem]">
                {change != null && change !== 0 && (
                  <div className="flex justify-between gap-3"><dt className="text-taupe">Başlangıçtan beri</dt><dd className="font-semibold tabular-nums">{change > 0 ? '+' : '−'}{kg(Math.abs(change))}</dd></div>
                )}
                {w.target != null && <div className="flex justify-between gap-3"><dt className="text-taupe">Hedef</dt><dd className="font-semibold tabular-nums">{kg(w.target)}</dd></div>}
                {w.measuredOn && <div className="flex justify-between gap-3"><dt className="text-taupe">Son ölçüm</dt><dd className="tabular-nums">{formatDayStr(w.measuredOn, 'd MMM yyyy')}</dd></div>}
              </dl>
            </Panel>
          )}

          {data.latestMessage && (
            <Panel>
              <PanelTitle action={<Link to="/hesabim/mesajlar" className="text-[0.88rem] font-medium text-taupe hover:text-espresso">Tümü</Link>}>Diyetisyeninden</PanelTitle>
              <p className="line-clamp-5 text-[0.98rem] leading-relaxed whitespace-pre-line">{data.latestMessage.content}</p>
              <p className="mt-3 text-[0.82rem] text-taupe">{formatDate(data.latestMessage.createdAt)}</p>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
