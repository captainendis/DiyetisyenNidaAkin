/** Doğrudan etiketli yatay oran çubukları — her satır adını ve değerini metinle taşır (renk tek başına anlam taşımaz). */
export interface ProportionRow { key: string; label: string; value: number; hint?: string; tone?: 'base' | 'muted' }

export function ProportionBars({ rows, total, unit = '' }: { rows: ProportionRow[]; total: number; unit?: string }) {
  return (
    <ul className="space-y-3.5">
      {rows.map((r) => {
        const pct = total ? Math.round((r.value / total) * 100) : 0;
        return (
          <li key={r.key}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
              <span className="text-cocoa">
                {r.label}
                {r.hint && <span className="ml-1.5 text-[0.75rem] text-panel-muted">{r.hint}</span>}
              </span>
              <span className="tabular whitespace-nowrap">
                <strong className="font-semibold text-espresso">{r.value}{unit}</strong>
                <span className="ml-1.5 text-[0.78rem] text-panel-muted">%{pct}</span>
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-panel-bg" aria-hidden>
              <div className={r.tone === 'muted' ? 'h-full rounded-full bg-mist' : 'h-full rounded-full bg-taupe'} style={{ width: `${pct}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
