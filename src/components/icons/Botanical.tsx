/**
 * Botanik çizgi-sanat. Dekorasyon dozu düşük tutulur: ince kontur, düşük opaklık, yalnızca boş alanlarda.
 * Tümü currentColor ile boyanır; aria-hidden.
 */
import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;
const base = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;

/** Uzun, kavisli dal + karşılıklı yapraklar (zeytin dalı hissi) */
export function OliveBranch(props: P) {
  return (
    <svg viewBox="0 0 220 520" strokeWidth={1} {...base} {...props}>
      <path d="M110 515C104 420 96 330 104 240C111 160 132 86 168 8" />
      {[
        [104, 470, -1], [103, 420, 1], [100, 372, -1], [101, 322, 1], [104, 272, -1], [109, 224, 1], [117, 178, -1], [128, 134, 1], [142, 92, -1], [156, 52, 1],
      ].map(([x, y, s], i) => {
        const len = 54 - i * 2.4;
        const dx = (s as number) * len;
        return (
          <g key={i}>
            <path d={`M${x} ${y}C${x + dx * 0.25} ${y - 26} ${x + dx * 0.8} ${y - 34} ${x + dx} ${y - 30}C${x + dx * 0.78} ${y - 12} ${x + dx * 0.32} ${y - 4} ${x} ${y}Z`} />
            <path d={`M${x} ${y}C${x + dx * 0.4} ${y - 14} ${x + dx * 0.7} ${y - 22} ${x + dx * 0.92} ${y - 28}`} opacity=".55" />
          </g>
        );
      })}
    </svg>
  );
}

/** Logo ile akraba, büyük ölçekli elma konturu (hero sağ kenarı için) */
export function AppleOutline(props: P) {
  return (
    <svg viewBox="0 0 64 64" strokeWidth={0.35} {...base} {...props}>
      <path d="M31 19.2C25 14.6 14.2 14.6 10.6 23C6.6 32.2 9.6 45 16.6 52.6C20.6 57 25.6 57.6 29.1 55.6C30.9 54.6 33.1 54.6 34.9 55.6C38.4 57.6 43.4 57 47.4 52.6C54.4 45 57 33.2 53.2 24.6C50.8 19.6 46 17.1 41 17.5" />
      <path d="M32.4 19.6C32.3 15.4 33.3 11.4 35.8 7.8" />
      <path d="M35 10.4C38.6 4.8 45.8 3.2 51 4.6C48.9 10.8 41.9 13.8 35 10.4Z" />
      <path d="M36.6 9.8C40.8 8.1 44.6 6.6 48.2 5.8" />
    </svg>
  );
}

/** Küçük filiz — bölüm ayraçları için */
export function Sprig(props: P) {
  return (
    <svg viewBox="0 0 80 40" strokeWidth={1} {...base} {...props}>
      <path d="M4 34C24 30 46 22 76 6" />
      <path d="M22 30C22 22 28 16 36 15C35 23 30 28 22 30Z" />
      <path d="M40 23C42 15 49 10 57 11C55 18 49 23 40 23Z" />
      <path d="M30 27C26 21 19 19 12 21C16 27 23 29 30 27Z" />
    </svg>
  );
}

/** Organik leke (blob) — krem zeminlerde çok hafif ton farkı */
export function OrganicShape(props: P) {
  return (
    <svg viewBox="0 0 600 600" aria-hidden {...props}>
      <path fill="currentColor" d="M421 72c62 37 112 104 120 178 9 77-25 163-86 220-61 58-149 87-233 71-83-16-162-77-188-156-27-80-1-178 54-245C143 73 227 37 300 36c45-1 84 14 121 36Z" />
    </svg>
  );
}

/** Uzun ince yaprak çifti (CTA bandı köşeleri) */
export function LeafPair(props: P) {
  return (
    <svg viewBox="0 0 260 260" strokeWidth={0.9} {...base} {...props}>
      <path d="M20 240C70 160 140 90 245 18" />
      <path d="M90 170C78 120 96 70 140 40C150 92 132 140 90 170Z" />
      <path d="M90 170C110 150 124 110 132 58" opacity=".5" />
      <path d="M150 112C170 70 210 46 252 46C238 90 200 116 150 112Z" />
      <path d="M150 112C180 96 210 76 238 54" opacity=".5" />
      <path d="M60 205C40 170 10 160 -10 165C6 196 30 210 60 205Z" />
    </svg>
  );
}
