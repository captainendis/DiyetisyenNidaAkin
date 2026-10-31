/**
 * Yığılmış sütun grafiği (SVG, bağımlılıksız).
 * Kurallar: sütun ≤24px, taban kare / üst uç 4px yuvarlak, segmentler arası 2px yüzey boşluğu,
 * tek eksen, kılavuz çizgileri 1px düz ve geri planda. ≥2 seri → lejant her zaman var.
 * Her sütunda üzerine gelince araç ipucu; ekran okuyucular için gizli tablo.
 */
import { useId, useMemo, useState } from 'react';

export interface StackSeries { key: string; label: string; color: string }
export interface StackDatum { key: string; label: string; sublabel?: string; values: Record<string, number> }

function niceMax(v: number) {
  if (v <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  const step = n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

export function StackedBarChart({ data, series, height = 220, caption }: { data: StackDatum[]; series: StackSeries[]; height?: number; caption: string }) {
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);
  const totals = data.map((d) => series.reduce((s, x) => s + (d.values[x.key] ?? 0), 0));
  const max = niceMax(Math.max(1, ...totals));
  const ticks = useMemo(() => {
    const step = max / 4;
    return [0, 1, 2, 3, 4].map((i) => Math.round(i * step));
  }, [max]);

  const W = 640;
  const padL = 28, padR = 8, padT = 12, padB = 40;
  const plotW = W - padL - padR;
  const plotH = height - padT - padB;
  const band = plotW / data.length;
  const barW = Math.min(24, band * 0.5);
  const y = (v: number) => padT + plotH - (v / max) * plotH;

  return (
    <figure className="relative">
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1" aria-hidden>
        {series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5 text-[0.75rem] text-panel-muted">
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${height}`} className="h-auto w-full overflow-visible" role="img" aria-labelledby={`${id}-cap`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="#ECE5DA" strokeWidth={1} />
            <text x={padL - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-panel-muted tabular" fontSize={11}>{t}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = padL + band * i + band / 2;
          let acc = 0;
          const segs = series
            .map((s) => ({ s, v: d.values[s.key] ?? 0 }))
            .filter((x) => x.v > 0);
          return (
            <g key={d.key} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={0} aria-label={`${d.label}: ${segs.map((x) => `${x.s.label} ${x.v}`).join(', ') || 'kayıt yok'}`}>
              <rect x={padL + band * i} y={padT} width={band} height={plotH} fill={hover === i ? 'rgba(48,34,25,0.04)' : 'transparent'} />
              {segs.map(({ s, v }, j) => {
                const y0 = y(acc);
                acc += v;
                const y1 = y(acc);
                const isTop = j === segs.length - 1;
                const h = Math.max(0, y0 - y1 - (j > 0 ? 2 : 0));
                const top = y1;
                const r = isTop ? Math.min(4, h) : 0;
                const x = cx - barW / 2;
                const path = `M${x},${top + h} L${x},${top + r} Q${x},${top} ${x + r},${top} L${x + barW - r},${top} Q${x + barW},${top} ${x + barW},${top + r} L${x + barW},${top + h} Z`;
                return <path key={s.key} d={path} fill={s.color} />;
              })}
              {totals[i] > 0 && (
                <text x={cx} y={y(totals[i]) - 6} textAnchor="middle" fontSize={11} className="fill-cocoa tabular font-semibold">{totals[i]}</text>
              )}
              <text x={cx} y={height - padB + 18} textAnchor="middle" fontSize={11} className={hover === i ? 'fill-espresso font-semibold' : 'fill-panel-muted'}>{d.label}</text>
              {d.sublabel && <text x={cx} y={height - padB + 32} textAnchor="middle" fontSize={10} className="fill-panel-muted/80 tabular">{d.sublabel}</text>}
            </g>
          );
        })}
        <line x1={padL} x2={W - padR} y1={y(0)} y2={y(0)} stroke="#D9CFC1" strokeWidth={1} />
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute top-8 z-10 min-w-40 -translate-x-1/2 rounded-lg bg-espresso px-3 py-2 text-[0.75rem] text-ivory shadow-lg"
          style={{ left: `${((padL + band * hover + band / 2) / W) * 100}%` }}
          role="status"
        >
          <p className="mb-1 font-semibold">{data[hover].label} {data[hover].sublabel}</p>
          {series.map((s) => (
            <p key={s.key} className="flex items-center justify-between gap-4">
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: s.color }} />{s.label}</span>
              <span className="tabular font-semibold">{data[hover].values[s.key] ?? 0}</span>
            </p>
          ))}
        </div>
      )}
      <figcaption id={`${id}-cap`} className="sr-only">{caption}</figcaption>
      <div className="sr-only"><table>
        <caption>{caption}</caption>
        <thead><tr><th>Gün</th>{series.map((s) => <th key={s.key}>{s.label}</th>)}</tr></thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.key}><th>{d.label} {d.sublabel}</th>{series.map((s) => <td key={s.key}>{d.values[s.key] ?? 0}</td>)}</tr>
          ))}
        </tbody>
      </table></div>
    </figure>
  );
}
