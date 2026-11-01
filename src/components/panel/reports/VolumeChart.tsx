// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Soru: "Kaç randevu vardı?" — tek seri dikey çubuk grafik (renk = tek ton, anlam etiketlerde).
 * Her çubuk kendi hover/odak hedefi; ipucu kutusu sonuç kırılımını gösterir. Tablo görünümü ReportsPage'de.
 */
import { useEffect, useRef, useState } from 'react';
import type { ReportBucket } from './types';

const H = 220;
const PAD = { t: 12, r: 8, b: 26, l: 32 };

function niceMax(v: number) {
  if (v <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  return (n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

export function VolumeChart({ buckets, ariaLabel }: { buckets: ReportBucket[]; ariaLabel: string }) {
  const [active, setActive] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Gerçek piksel genişliğinde çiz (metin ölçeklenmez); çok sayıda çubukta yatay kaydırma
  const W = Math.max(width, buckets.length * 12 + PAD.l + PAD.r);
  const max = niceMax(Math.max(1, ...buckets.map((b) => b.total)));
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const slot = innerW / buckets.length;
  const barW = Math.max(3, Math.min(36, slot - 2));
  const y = (v: number) => PAD.t + innerH - (v / max) * innerH;
  const ticks = [0, max / 2, max];
  const labelEvery = Math.ceil(buckets.length / Math.max(1, Math.floor(innerW / 64)));
  const a = active != null ? buckets[active] : null;

  return (
    <div className="relative">
      <div ref={box} className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block" role="img" aria-label={ariaLabel} onPointerLeave={() => setActive(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="#e7dfd3" strokeWidth={1} />
              <text x={PAD.l - 6} y={y(t)} dy="0.32em" textAnchor="end" className="tabular fill-panel-muted text-[10px]">{t}</text>
            </g>
          ))}
          {buckets.map((b, i) => {
            const x = PAD.l + i * slot + (slot - barW) / 2;
            const h = Math.max(b.total ? 2 : 0, innerH - (y(b.total) - PAD.t));
            const r = Math.min(4, barW / 2, h);
            return (
              <g key={b.key}>
                {b.total > 0 && (
                  <path
                    d={`M${x},${PAD.t + innerH} V${PAD.t + innerH - h + r} Q${x},${PAD.t + innerH - h} ${x + r},${PAD.t + innerH - h} H${x + barW - r} Q${x + barW},${PAD.t + innerH - h} ${x + barW},${PAD.t + innerH - h + r} V${PAD.t + innerH} Z`}
                    fill={active === i ? '#302219' : '#7a6555'}
                  />
                )}
                <rect
                  x={PAD.l + i * slot}
                  y={PAD.t}
                  width={slot}
                  height={innerH}
                  fill="transparent"
                  tabIndex={0}
                  role="graphics-symbol"
                  aria-label={`${b.label}: ${b.total} randevu`}
                  onPointerEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  className="cursor-default outline-none focus-visible:fill-cocoa/5"
                />
                {i % labelEvery === 0 && (
                  <text x={PAD.l + i * slot + slot / 2} y={H - 8} textAnchor="middle" className="fill-panel-muted text-[10px]">{b.label.replace(' haftası', '')}</text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      {a && (
        <div
          className="pointer-events-none absolute top-0 z-10 w-48 rounded-lg bg-espresso px-3 py-2.5 text-ivory shadow-lg"
          style={{ left: Math.max(0, Math.min(width - 192, PAD.l + (active! + 0.5) * slot - 96 - (box.current?.scrollLeft ?? 0))) }}
        >
          <p className="tabular text-base font-bold">{a.total} randevu</p>
          <p className="mb-1.5 text-[0.72rem] text-mist">{a.label}</p>
          <dl className="tabular grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 text-[0.75rem]">
            <dt className="text-mist">Tamamlandı</dt><dd>{a.completed}</dd>
            <dt className="text-mist">Onaylı / bekleyen</dt><dd>{a.confirmed + a.pending}</dd>
            <dt className="text-mist">İptal</dt><dd>{a.cancelled}</dd>
            <dt className="text-mist">Gelmedi</dt><dd>{a.noShow}</dd>
          </dl>
        </div>
      )}
    </div>
  );
}
