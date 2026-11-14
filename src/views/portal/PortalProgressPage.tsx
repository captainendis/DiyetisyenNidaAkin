// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

'use client';

import { useEffect } from 'react';
import { portalApi } from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import { formatDayStr } from '@/lib/format';
import type { PortalMeasurement } from '@shared/portal';
import { WeightTrend } from '@/components/panel/clients/WeightTrend';
import { Empty, LoadError, Loading, Panel, PanelTitle, PortalPageHeader } from '@/components/portal/ui';

const num = (v: number | null, unit: string) => (v == null ? '—' : `${v.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} ${unit}`);

export default function PortalProgressPage() {
  const { data, error, loading, reload } = useApi(() => portalApi.get<{ items: PortalMeasurement[] }>('/measurements'), []);
  useEffect(() => {
    document.title = 'Ölçümlerim | Nida Akın';
  }, []);
  const items = data?.items ?? [];
  const chart = items.map((m) => ({ ...m, note: null, bmi: null, createdAt: m.measuredOn }));

  return (
    <>
      <PortalPageHeader title="Ölçümler" lead="Görüşmelerde alınan ölçümlerin. Kilo günden güne dalgalanır; tek tek sayılara değil, birkaç ölçümün gidişatına bak." />
      {loading && !data ? (
        <Loading />
      ) : error ? (
        <LoadError message={error.message} onRetry={reload} />
      ) : !items.length ? (
        <Empty title="Henüz ölçüm yok.">Görüşmede alınan ölçümlerin burada görünecek.</Empty>
      ) : (
        <div className="space-y-6">
          {chart.filter((m) => m.weightKg != null).length > 1 && (
            <Panel>
              <PanelTitle>Kilo</PanelTitle>
              <WeightTrend items={chart} />
            </Panel>
          )}
          <Panel className="p-0 sm:p-0">
            <table className="w-full text-left text-[0.95rem]">
              <caption className="sr-only">Ölçüm geçmişi</caption>
              <thead>
                <tr className="border-b border-espresso/10 text-[0.85rem] font-semibold text-taupe">
                  <th scope="col" className="px-5 py-3 font-bold">Tarih</th>
                  <th scope="col" className="px-3 py-3 text-right font-bold">Kilo</th>
                  <th scope="col" className="hidden px-3 py-3 text-right font-bold sm:table-cell">Boy</th>
                  <th scope="col" className="px-5 py-3 text-right font-bold">Hedef</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-espresso/10 tabular-nums">
                {items.map((m) => (
                  <tr key={m.id}>
                    <td className="px-5 py-3">{formatDayStr(m.measuredOn, 'd MMM yyyy')}</td>
                    <td className="px-3 py-3 text-right font-semibold">{num(m.weightKg, 'kg')}</td>
                    <td className="hidden px-3 py-3 text-right sm:table-cell">{num(m.heightCm, 'cm')}</td>
                    <td className="px-5 py-3 text-right">{num(m.targetWeightKg, 'kg')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </div>
      )}
    </>
  );
}
