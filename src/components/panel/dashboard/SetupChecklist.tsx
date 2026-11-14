// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * "Siteyi tamamlayın" — yayın öncesi panelden doldurulması gereken bilgiler.
 * Her madde sunucuda gerçek veriden hesaplanır (GET /api/dashboard/setup); tamamlandıkça işaretlenir.
 */
import { useState } from 'react';
import { Link } from '@/lib/router';
import { Check, ChevronDown, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import { Card } from '@/components/panel/ui';
import { cn } from '@/lib/format';

interface SetupItem { key: string; group: string; label: string; hint?: string; done: boolean; href: string }

export function SetupChecklist() {
  const { data } = useApi(() => api.get<{ items: SetupItem[]; done: number; total: number }>('/dashboard/setup'), []);
  const [showDone, setShowDone] = useState(false);
  if (!data || data.done === data.total) return null;
  const pending = data.items.filter((i) => !i.done);
  const done = data.items.filter((i) => i.done);
  const pct = Math.round((data.done / data.total) * 100);

  return (
    <Card className="mb-6 overflow-hidden">
      <div className="flex flex-col gap-4 px-5 pt-5 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-[0.95rem] font-bold text-espresso">Siteyi tamamlayın</h2>
          <p className="mt-0.5 text-[0.8rem] text-panel-muted">
            Bu bilgiler girildikçe web sitesindeki “Yakında eklenecek” alanları kendiliğinden dolar.
          </p>
        </div>
        <div className="flex items-center gap-3 sm:w-64">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel-bg" role="progressbar" aria-valuenow={data.done} aria-valuemin={0} aria-valuemax={data.total} aria-label="Tamamlanan maddeler">
            <div className="h-full rounded-full bg-success transition-[width]" style={{ width: `${pct}%` }} />
          </div>
          <span className="tabular text-[0.8rem] font-semibold text-cocoa">{data.done}/{data.total}</span>
        </div>
      </div>
      <ul className="grid border-t border-panel-line sm:grid-cols-2 xl:grid-cols-3">
        {pending.map((i) => (
          <li key={i.key} className="border-b border-panel-line/70 sm:odd:border-r xl:border-r xl:[&:nth-child(3n)]:border-r-0">
            <Link to={i.href} className="group flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-panel-bg/60">
              <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full border-[1.5px] border-panel-muted/50" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-[0.72rem] font-semibold tracking-wide text-panel-muted uppercase">{i.group}</span>
                <span className="block text-sm font-medium text-espresso">{i.label}</span>
                {i.hint && <span className="mt-0.5 block text-[0.75rem] text-panel-muted">{i.hint}</span>}
              </span>
              <ChevronRight className="mt-3 h-4 w-4 shrink-0 text-panel-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      {done.length > 0 && (
        <div className="px-5 py-3">
          <button type="button" onClick={() => setShowDone((v) => !v)} aria-expanded={showDone} className="flex items-center gap-1.5 text-[0.8rem] font-semibold text-panel-muted hover:text-cocoa">
            <ChevronDown className={cn('h-4 w-4 transition-transform', !showDone && '-rotate-90')} />
            Tamamlananlar ({done.length})
          </button>
          {showDone && (
            <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5">
              {done.map((i) => (
                <li key={i.key} className="flex items-center gap-1.5 text-[0.8rem] text-cocoa/70">
                  <Check className="h-3.5 w-3.5 text-success-ink" aria-hidden /> {i.label}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}
