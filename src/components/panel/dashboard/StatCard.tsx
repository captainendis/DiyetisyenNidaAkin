import type { ReactNode } from 'react';
import { Info } from 'lucide-react';
import { Sparkline } from '../charts/Sparkline';
import { Card, Skeleton } from '../ui';

export function StatCard({
  label, value, definition, comparison, series, seriesLabel, href,
}: {
  label: string;
  value: number;
  definition: string;
  comparison: ReactNode;
  series: number[];
  seriesLabel: string;
  href?: string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[0.8rem] font-semibold text-cocoa">{label}</p>
        <span className="group relative" tabIndex={0} aria-label={definition}>
          <Info className="h-3.5 w-3.5 text-panel-muted" aria-hidden />
          <span role="tooltip" className="pointer-events-none absolute top-5 right-0 z-20 hidden w-56 rounded-lg bg-espresso px-3 py-2 text-[0.75rem] leading-snug font-normal text-ivory shadow-lg group-hover:block group-focus:block">
            {definition}
          </span>
        </span>
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="font-sans text-[2.4rem] leading-none font-bold tracking-tight text-espresso tabular">{value.toLocaleString('tr-TR')}</p>
        <Sparkline values={series} label={seriesLabel} />
      </div>
      <p className="mt-3 text-[0.76rem] leading-snug text-panel-muted">{comparison}</p>
    </>
  );
  return (
    <Card className="p-5 transition-colors hover:border-cocoa/25" as="article">
      {href ? <a href={href} className="block focus:outline-none">{body}</a> : body}
    </Card>
  );
}

export function StatCardSkeleton() {
  return (
    <Card className="p-5" as="div">
      <Skeleton className="h-3 w-28" />
      <div className="mt-4 flex items-end justify-between">
        <Skeleton className="h-9 w-16" />
        <Skeleton className="h-8 w-24" />
      </div>
      <Skeleton className="mt-4 h-3 w-40" />
    </Card>
  );
}
