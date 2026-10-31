/** Hero özellik ikonları — özel ince çizgi (Lucide değil) */
import type { SVGProps } from 'react';

const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, viewBox: '0 0 40 40' } as const;

/** Kişiye özel plan: elma + ölçü çizgileri */
export function PlanIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M19.4 12.2c-3.6-2.7-10-2.7-12.2 2.3-2.4 5.5-.6 13.2 3.6 17.7 2.4 2.6 5.3 3 7.4 1.8a2.7 2.7 0 0 1 2.7 0c2.1 1.2 5 .8 7.4-1.8 4.2-4.5 5.7-11.6 3.5-16.7-1.4-3-4.3-4.5-7.3-4.2" />
      <path d="M20.2 12.4c0-2.5.6-4.9 2.1-7.1M21.7 6.9c2.1-3.3 6.4-4.3 9.5-3.4-1.3 3.7-5.4 5.5-9.5 3.4Z" />
    </svg>
  );
}

/** Sağlıklı yaşam: kalp + nabız çizgisi */
export function VitalityIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M20 33.5S5.5 25.3 5.5 15.2A7.7 7.7 0 0 1 20 11.5a7.7 7.7 0 0 1 14.5 3.7C34.5 25.3 20 33.5 20 33.5Z" />
      <path d="M9.5 20.5h6l2-4 3.2 8 2.3-4h7.5" />
    </svg>
  );
}

/** Sürdürülebilir: lotus */
export function LotusIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M20 31c-3.6-3-5.2-7-5.2-11.2 0-3.4 2-7.2 5.2-10 3.2 2.8 5.2 6.6 5.2 10C25.2 24 23.6 28 20 31Z" />
      <path d="M20 31c-5.5.3-10.3-1.8-13.4-6 1.9-2.3 5-3.5 8.3-3.4M20 31c5.5.3 10.3-1.8 13.4-6-1.9-2.3-5-3.5-8.3-3.4" />
      <path d="M20 31c-4.6-1.2-9.4-1.2-14 .5M20 31c4.6-1.2 9.4-1.2 14 .5" opacity=".6" />
    </svg>
  );
}

export const FEATURE_ICONS = [PlanIcon, VitalityIcon, LotusIcon];
