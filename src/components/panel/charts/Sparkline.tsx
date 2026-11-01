// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Küçük eğilim çizgisi: 2px çizgi, son noktada ≥8px işaret + 2px yüzey halkası. Tek seri → lejant yok. */
export function Sparkline({ values, color = '#302219', width = 96, height = 32, label }: { values: number[]; color?: string; width?: number; height?: number; label: string }) {
  if (!values.length) return null;
  const max = Math.max(1, ...values);
  const pad = 5;
  const step = values.length > 1 ? (width - pad * 2) / (values.length - 1) : 0;
  const pts = values.map((v, i) => [pad + i * step, height - pad - (v / max) * (height - pad * 2)] as const);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${d} L${pts[pts.length - 1][0]},${height - pad} L${pts[0][0]},${height - pad} Z`;
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label={label} className="overflow-visible">
      <path d={area} fill={color} opacity={0.08} />
      <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r={4} fill={color} stroke="#fff" strokeWidth={2} />
    </svg>
  );
}
