// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import { useMemo, useState } from 'react';
import { BarChart3, Download, Table2 } from 'lucide-react';
import { DateTime } from 'luxon';
import { api } from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import { cn, formatDayStr } from '@/lib/format';
import { TIME_ZONE } from '@shared/constants';
import { Button, Card, CardHeader, EmptyState, ErrorState, Input, PageHeader, Skeleton } from '@/components/panel/ui';
import { RequirePermission } from '@/components/panel/PanelAuth';
import { VolumeChart } from '@/components/panel/reports/VolumeChart';
import { ProportionBars } from '@/components/panel/reports/ProportionBars';
import type { ReportBucket, ReportData } from '@/components/panel/reports/types';

type Preset = 'week' | 'month' | 'last30' | 'last90' | 'year' | 'custom';
type Grain = 'daily' | 'weekly' | 'monthly';

function presetRange(p: Exclude<Preset, 'custom'>) {
  const now = DateTime.now().setZone(TIME_ZONE);
  const iso = (d: DateTime) => d.toISODate()!;
  switch (p) {
    case 'week': return { from: iso(now.startOf('week')), to: iso(now.endOf('week')) };
    case 'month': return { from: iso(now.startOf('month')), to: iso(now.endOf('month')) };
    case 'last30': return { from: iso(now.minus({ days: 29 })), to: iso(now) };
    case 'last90': return { from: iso(now.minus({ months: 3 }).plus({ days: 1 })), to: iso(now) };
    case 'year': return { from: iso(now.startOf('year')), to: iso(now.endOf('year')) };
  }
}

const PRESETS: { value: Exclude<Preset, 'custom'>; label: string }[] = [
  { value: 'week', label: 'Bu hafta' },
  { value: 'month', label: 'Bu ay' },
  { value: 'last30', label: 'Son 30 gün' },
  { value: 'last90', label: 'Son 3 ay' },
  { value: 'year', label: 'Bu yıl' },
];
const GRAINS: { value: Grain; label: string }[] = [
  { value: 'daily', label: 'Gün' },
  { value: 'weekly', label: 'Hafta' },
  { value: 'monthly', label: 'Ay' },
];

function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap rounded-lg bg-white p-1 ring-1 ring-panel-line ring-inset">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn('rounded-md px-3 py-1.5 text-[0.8rem] font-semibold whitespace-nowrap transition-colors', value === o.value ? 'bg-cocoa text-ivory' : 'text-cocoa/70 hover:text-cocoa')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Kpi({ label, value, definition }: { label: string; value: number | string; definition: string }) {
  return (
    <div className="bg-white p-4 sm:p-5">
      <dt className="text-[0.72rem] font-semibold tracking-wide text-panel-muted uppercase">{label}</dt>
      <dd className="mt-1.5 font-display text-[2.1rem] leading-none font-medium text-espresso [font-variant-numeric:lining-nums_tabular-nums]">{value}</dd>
      <dd className="mt-2 text-[0.75rem] leading-snug text-panel-muted">{definition}</dd>
    </div>
  );
}

function BucketTable({ buckets }: { buckets: ReportBucket[] }) {
  const rows = buckets.filter((b) => b.total > 0);
  if (!rows.length) return <p className="px-5 pb-5 text-sm text-panel-muted">Bu aralıkta randevu yok.</p>;
  return (
    <div className="max-h-80 overflow-auto">
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 bg-white">
          <tr className="border-b border-panel-line text-[0.72rem] font-semibold tracking-wide text-panel-muted uppercase">
            <th scope="col" className="px-5 py-2.5">Dönem</th>
            <th scope="col" className="px-3 py-2.5 text-right">Toplam</th>
            <th scope="col" className="px-3 py-2.5 text-right">Tamamlandı</th>
            <th scope="col" className="hidden px-3 py-2.5 text-right sm:table-cell">Onaylı / bekleyen</th>
            <th scope="col" className="px-3 py-2.5 text-right">İptal</th>
            <th scope="col" className="px-5 py-2.5 text-right">Gelmedi</th>
          </tr>
        </thead>
        <tbody className="tabular">
          {rows.map((b) => (
            <tr key={b.key} className="border-b border-panel-line/70 last:border-0">
              <th scope="row" className="px-5 py-2.5 font-medium text-espresso">{b.label}</th>
              <td className="px-3 py-2.5 text-right font-semibold">{b.total}</td>
              <td className="px-3 py-2.5 text-right">{b.completed}</td>
              <td className="hidden px-3 py-2.5 text-right sm:table-cell">{b.confirmed + b.pending}</td>
              <td className="px-3 py-2.5 text-right">{b.cancelled}</td>
              <td className="px-5 py-2.5 text-right">{b.noShow}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Reports() {
  const [preset, setPreset] = useState<Preset>('month');
  const [range, setRange] = useState(() => presetRange('month'));
  const [grain, setGrain] = useState<Grain | null>(null);
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const { data, error, loading, reload } = useApi(() => api.get<ReportData>('/reports', range), [range.from, range.to]);

  const days = data?.range.days ?? 31;
  const autoGrain: Grain = days <= 45 ? 'daily' : days <= 200 ? 'weekly' : 'monthly';
  const g = grain ?? autoGrain;
  const buckets = data ? data[g] : [];

  const t = data?.totals;
  const resolved = t ? t.completed + t.cancelled + t.noShow : 0;
  const rangeLabel = `${formatDayStr(range.from, 'd MMM yyyy')} – ${formatDayStr(range.to, 'd MMM yyyy')}`;
  const grainWord = { daily: 'Günlük', weekly: 'Haftalık', monthly: 'Aylık' }[g];

  const outcomeRows = useMemo(
    () =>
      t
        ? [
            { key: 'c', label: 'Tamamlandı', value: t.completed },
            { key: 'x', label: 'İptal edildi', value: t.cancelled, tone: 'muted' as const },
            { key: 'n', label: 'Gelmedi', value: t.noShow, tone: 'muted' as const },
          ]
        : [],
    [t],
  );

  return (
    <>
      <PageHeader
        title="Raporlar"
        description={`Randevu ve danışan istatistikleri · ${rangeLabel}`}
        actions={
          <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={() => api.download('/reports/export.csv', range)} disabled={!t?.appointments}>
            CSV olarak indir
          </Button>
        }
      />

      <div className="mb-6 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <Segmented<Preset>
            label="Tarih aralığı"
            value={preset}
            onChange={(p) => {
              setPreset(p);
              setGrain(null);
              if (p !== 'custom') setRange(presetRange(p));
            }}
            options={[...PRESETS, { value: 'custom', label: 'Özel' }]}
          />
        </div>
        {preset === 'custom' && (
          <div className="flex flex-wrap items-end gap-3">
            <Input label="Başlangıç" type="date" value={range.from} max={range.to} onChange={(e) => e.target.value && setRange((r) => ({ ...r, from: e.target.value }))} wrapperClassName="w-40" />
            <Input label="Bitiş" type="date" value={range.to} min={range.from} onChange={(e) => e.target.value && setRange((r) => ({ ...r, to: e.target.value }))} wrapperClassName="w-40" />
          </div>
        )}
      </div>

      {error ? (
        <Card><ErrorState message={error.message} onRetry={reload} /></Card>
      ) : !data || !t ? (
        <div className="space-y-6" aria-busy="true">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
      ) : (
        <div className={cn('space-y-6', loading && 'opacity-60 transition-opacity')}>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-panel-line bg-panel-line lg:grid-cols-4">
            <Kpi label="Randevu" value={t.appointments} definition="Bu aralıkta saati planlanmış tüm randevular (iptaller dahil)." />
            <Kpi label="Tamamlanan" value={t.completed} definition="Gerçekleşti olarak işaretlenen görüşmeler." />
            <Kpi label="Yeni danışan" value={t.newClients} definition="Bu aralıkta kaydı oluşturulan danışanlar." />
            <Kpi label="Tekrar gelen" value={t.returningClients} definition="Bu aralıkta görüşmesi tamamlanan ve toplamda en az 2 görüşmesi olan danışanlar." />
          </dl>

          {t.appointments === 0 && t.untimedRequests === 0 ? (
            <Card>
              <EmptyState
                icon={<BarChart3 className="h-5 w-5" />}
                title="Bu aralıkta randevu bulunmuyor."
                description="Farklı bir tarih aralığı seçin. Randevular oluşturuldukça grafikler burada görünecek."
              />
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader
                  title={`${grainWord} randevu sayısı`}
                  description="Her çubuk o dönemde planlanmış randevuların toplamı. Ayrıntı için çubuğun üzerine gelin veya tablo görünümünü açın."
                  action={
                    <div className="flex flex-wrap items-center gap-2">
                      <Segmented<Grain> label="Zaman ölçeği" value={g} onChange={setGrain} options={GRAINS} />
                      <Segmented<'chart' | 'table'> label="Görünüm" value={view} onChange={setView} options={[{ value: 'chart', label: 'Grafik' }, { value: 'table', label: 'Tablo' }]} />
                    </div>
                  }
                />
                <div className={view === 'chart' ? 'px-3 pt-4 pb-4 sm:px-5' : 'pt-3'}>
                  {view === 'chart' ? (
                    <VolumeChart buckets={buckets} ariaLabel={`${grainWord} randevu sayısı, ${rangeLabel}. Toplam ${t.appointments} randevu.`} />
                  ) : (
                    <BucketTable buckets={buckets} />
                  )}
                </div>
                {view === 'chart' && (
                  <p className="flex items-center gap-1.5 border-t border-panel-line px-5 py-3 text-[0.75rem] text-panel-muted">
                    <Table2 className="h-3.5 w-3.5" /> Değerlerin tamamı tablo görünümünde de listelenir.
                  </p>
                )}
              </Card>

              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="pb-5">
                  <CardHeader title="Randevular nasıl sonuçlandı?" description={`Sonuçlanan ${resolved} randevu içinde dağılım.`} />
                  <div className="px-5 pt-5">
                    {resolved ? <ProportionBars rows={outcomeRows} total={resolved} /> : <p className="text-sm text-panel-muted">Bu aralıkta henüz sonuçlanmış randevu yok.</p>}
                    {(t.confirmed > 0 || t.pending > 0 || t.untimedRequests > 0) && (
                      <p className="mt-4 border-t border-panel-line pt-3 text-[0.78rem] text-panel-muted">
                        Henüz sonuçlanmamış: <span className="tabular font-semibold text-cocoa">{t.confirmed}</span> onaylı,{' '}
                        <span className="tabular font-semibold text-cocoa">{t.pending}</span> onay bekleyen
                        {t.untimedRequests > 0 && <>, <span className="tabular font-semibold text-cocoa">{t.untimedRequests}</span> saat belirtilmemiş talep</>}.
                      </p>
                    )}
                  </div>
                </Card>
                <Card className="pb-5">
                  <CardHeader title="Randevular nereden ve nasıl?" description="Görüşme türü ve randevunun oluşturulduğu yer." />
                  <div className="space-y-6 px-5 pt-5">
                    <ProportionBars
                      total={t.appointments}
                      rows={[
                        { key: 'ip', label: 'Yüz yüze', value: data.byMeetingType.IN_PERSON },
                        { key: 'on', label: 'Online', value: data.byMeetingType.ONLINE, tone: 'muted' },
                      ]}
                    />
                    <ProportionBars
                      total={t.appointments}
                      rows={[
                        { key: 'w', label: 'Web sitesi talebi', value: data.bySource.WEBSITE },
                        { key: 'p', label: 'Panelden oluşturulan', value: data.bySource.PANEL, tone: 'muted' },
                      ]}
                    />
                  </div>
                </Card>
              </div>
            </>
          )}
          <p className="text-[0.75rem] text-panel-muted">
            Gelir raporları, ücret ve ödeme takibi modülü eklendiğinde kullanılabilir olacak. Raporlar ve CSV dosyası klinik veri içermez.
          </p>
        </div>
      )}
    </>
  );
}

export default function ReportsPage() {
  return (
    <RequirePermission perm="reports:read">
      <Reports />
    </RequirePermission>
  );
}
