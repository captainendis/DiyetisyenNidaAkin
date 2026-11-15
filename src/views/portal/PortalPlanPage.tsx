// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

'use client';

/** /hesabim/listeler/:id — listenin ekran hâli + yazdırma sayfası (yazdır / PDF olarak kaydet) */
import { useEffect } from 'react';
import { Link, useParams } from '@/lib/router';
import { Printer } from 'lucide-react';
import { portalApi } from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import { formatDate } from '@/lib/format';
import type { PortalPlan } from '@shared/portal';
import { PlanTimeline } from '@/components/portal/PlanTimeline';
import { Empty, LoadError, Loading, Panel, PanelTitle, PortalPageHeader } from '@/components/portal/ui';

export default function PortalPlanPage() {
  const { id = '' } = useParams();
  const { data, error, loading, reload } = useApi(() => portalApi.get<{ plan: PortalPlan }>(`/plans/${id}`), [id]);
  const plan = data?.plan;
  useEffect(() => {
    if (plan) document.title = `${plan.name} | Nida Akın`;
  }, [plan]);

  const back = { to: '/hesabim/listeler', label: 'Listelerim' };
  if (loading && !data) return <Loading rows={4} />;
  if (error?.status === 404) return <><PortalPageHeader title="Liste bulunamadı" back={back} /><Empty title="Bu liste artık yok.">Silinmiş ya da bağlantı hatalı olabilir.</Empty></>;
  if (error || !plan) return <LoadError message={error?.message} onRetry={reload} />;

  const d = plan.data;
  const printUrl = portalApi.url(`/plans/${plan.id}/print`, { autoprint: 1 });

  return (
    <>
      <PortalPageHeader
        back={back}
        title={plan.name}
        lead={<>{d.subtitle && <span className="block">{d.subtitle}</span>}<span className="mt-1 block text-[0.9rem] text-taupe">{formatDate(plan.createdAt)} tarihinde verildi</span></>}
        actions={
          <>
            <a href={printUrl} target="_blank" rel="noopener" className="inline-flex h-11 items-center gap-2 rounded-full bg-espresso px-5 text-[0.92rem] font-semibold text-ivory hover:bg-cocoa"><Printer className="h-4 w-4" aria-hidden /> Yazdır / PDF</a>
          </>
        }
      />

      {(d.water.show && (d.water.liters || d.water.glasses > 0)) || (d.activity.show && d.activity.label) ? (
        <dl className="mb-8 flex flex-wrap gap-3">
          {d.water.show && (d.water.liters || d.water.glasses > 0) && (
            <div className="rounded-md bg-white px-4 py-3 ring-1 ring-espresso/[0.07]">
              <dt className="text-[0.85rem] font-semibold text-taupe">Su</dt>
              <dd className="mt-0.5 font-semibold">{[d.water.liters && `${d.water.liters} litre`, d.water.glasses > 0 && `${d.water.glasses} bardak`].filter(Boolean).join(' · ')}</dd>
            </div>
          )}
          {d.activity.show && d.activity.label && (
            <div className="rounded-md bg-white px-4 py-3 ring-1 ring-espresso/[0.07]">
              <dt className="text-[0.85rem] font-semibold text-taupe">Hareket</dt>
              <dd className="mt-0.5 font-semibold">{d.activity.label}</dd>
            </div>
          )}
        </dl>
      ) : null}

      <PlanTimeline data={d} />

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        {d.habits.items.length > 0 && (
          <section className="rounded-lg bg-espresso p-6 text-cream sm:p-7">
            {d.habits.title && <h2 className="mb-4 font-display text-[1.6rem] font-medium text-ivory">{d.habits.title}</h2>}
            <ul className=" space-y-3">
              {d.habits.items.map((h, i) => (
                <li key={i} className="text-[0.98rem] leading-relaxed"><b className="font-semibold text-rose">{h.title}</b> {h.text}</li>
              ))}
            </ul>
          </section>
        )}
        {d.portions.items.length > 0 && (
          <Panel>
            {d.portions.title && <PanelTitle>{d.portions.title}</PanelTitle>}
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {d.portions.items.map((p, i) => (
                <li key={i} className="rounded-lg bg-cream/60 px-3 py-2">
                  <b className="block text-[0.95rem] font-semibold">{p.name}</b>
                  <span className="text-[0.85rem] text-taupe">{p.amount}</span>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>

      {plan.recipes.length > 0 && (
        <Panel className="mt-6">
          <PanelTitle>{'Bu listedeki tarifler'}</PanelTitle>
          <ul className="divide-y divide-espresso/10">
            {plan.recipes.map((r) => (
              <li key={r.id}>
                <Link to={`/hesabim/tarifler/${r.id}`} className="flex items-baseline justify-between gap-4 py-3 hover:text-cocoa">
                  <span className="text-[1rem] font-semibold">{r.title}</span>
                  {r.label && <span className="shrink-0 text-[0.85rem] text-taupe">{r.label}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {(d.footerNote || d.signature) && (
        <footer className="mt-10 flex flex-col gap-1 border-t border-espresso/10 pt-6 text-[0.9rem] text-taupe sm:flex-row sm:justify-between">
          <span>{d.footerNote}</span>
          <span>{d.signature}</span>
        </footer>
      )}
    </>
  );
}
