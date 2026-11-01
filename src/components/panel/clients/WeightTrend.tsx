// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Soru: "Kilo zaman içinde nasıl değişti?" — tek seri çizgi grafik.
 * Hedef kilo (varsa) kesikli referans çizgisi. Hover/odakta en yakın ölçüm gösterilir; tablo görünümü ayrıca MeasurementsTab'da.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { formatDayStr } from '@/lib/format';
import type { Measurement } from './types';

const H = 220;
const PAD = { t: 16, r: 16, b: 28, l: 40 };

export function WeightTrend({ items }: { items: Measurement[] }) {
  const pts = useMemo(
    () => items.filter((m) => m.weightKg != null).sort((a, b) => a.measuredOn.localeCompare(b.measuredOn)),
    [items],
  );
  const target = items.find((m) => m.targetWeightKg != null)?.targetWeightKg ?? null;
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (pts.length < 2) return <div ref={box} />;
  const t0 = Date.parse(pts[0].measuredOn);
  const t1 = Date.parse(pts[pts.length - 1].measuredOn);
  const vals = pts.map((p) => p.weightKg!).concat(target != null ? [target] : []);
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  const padV = Math.max(1, (hi - lo) * 0.15);
  lo = Math.floor(lo - padV);
  hi = Math.ceil(hi + padV);
  const x = (d: string) => PAD.l + ((Date.parse(d) - t0) / Math.max(1, t1 - t0)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
  const ticks = [lo, Math.round((lo + hi) / 2), hi];
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.measuredOn).toFixed(1)},${y(p.weightKg!).toFixed(1)}`).join(' ');
  const h = hover != null ? pts[hover] : null;

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const r = svgRef.current!.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    let best = 0;
    pts.forEach((p, i) => {
      if (Math.abs(x(p.measuredOn) - px) < Math.abs(x(pts[best].measuredOn) - px)) best = i;
    });
    setHover(best);
  }

  return (
    <figure className="relative" ref={box}>
      <figcaption className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[0.95rem] font-bold text-espresso">Kilo zaman içinde nasıl değişti?</span>
        <span className="flex items-center gap-4 text-[0.75rem] text-panel-muted">
          <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-taupe" /> Kilo (kg)</span>
          {target != null && <span className="flex items-center gap-1.5"><span className="w-4 border-t border-dashed border-success" /> Hedef {target} kg</span>}
        </span>
      </figcaption>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        className="block touch-none"
        role="img"
        aria-label={`Kilo grafiği: ${pts.length} ölçüm, ilk ${pts[0].weightKg} kg, son ${pts[pts.length - 1].weightKg} kg`}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="#e7dfd3" strokeWidth={1} />
            <text x={PAD.l - 8} y={y(t)} dy="0.32em" textAnchor="end" className="tabular fill-panel-muted text-[11px]">{t}</text>
          </g>
        ))}
        {target != null && <line x1={PAD.l} x2={W - PAD.r} y1={y(target)} y2={y(target)} stroke="#6C9275" strokeWidth={1.5} strokeDasharray="5 4" />}
        <path d={path} fill="none" stroke="#7a6555" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((p, i) => (
          <circle key={p.id} cx={x(p.measuredOn)} cy={y(p.weightKg!)} r={hover === i ? 5 : 4} fill="#7a6555" stroke="#fff" strokeWidth={2} />
        ))}
        {h && <line x1={x(h.measuredOn)} x2={x(h.measuredOn)} y1={PAD.t} y2={H - PAD.b} stroke="#302219" strokeOpacity={0.25} strokeWidth={1} />}
        <text x={PAD.l} y={H - 8} className="fill-panel-muted text-[11px]">{formatDayStr(pts[0].measuredOn, 'd MMM yyyy')}</text>
        <text x={W - PAD.r} y={H - 8} textAnchor="end" className="fill-panel-muted text-[11px]">{formatDayStr(pts[pts.length - 1].measuredOn, 'd MMM yyyy')}</text>
      </svg>
      {h && (
        <div
          className="pointer-events-none absolute top-8 rounded-lg bg-espresso px-3 py-2 text-ivory shadow-lg"
          style={{ left: Math.max(0, Math.min(W - 130, x(h.measuredOn) - 60)) }}
        >
          <p className="tabular text-sm font-bold">{h.weightKg} kg</p>
          <p className="text-[0.72rem] text-mist">{formatDayStr(h.measuredOn, 'd MMMM yyyy')}</p>
        </div>
      )}
    </figure>
  );
}
