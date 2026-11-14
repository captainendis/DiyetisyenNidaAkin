// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Tarif diyet türü ikonları — özel ince çizgi (Lucide değil) */
import type { ComponentType, SVGProps } from 'react';
import type { DietTag } from '@shared/recipe';

const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, viewBox: '0 0 40 40' } as const;

/** Vegan: yaprak */
export function VeganIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M8 32C6.5 19 14 8.5 33 7.5c1 17-7.5 26-20 24.5" />
      <path d="M8 32c5-8 11-14 19-18.5" />
      <path d="M17 26.5l-.5-6M22.5 21l.5-6" opacity=".6" />
    </svg>
  );
}

/** Vejetaryen: havuç */
export function VegetarianIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M26.5 14.5c3 3 .5 8.5-5.5 14.5l-8.5 7.5c-1 .8-2-.2-1.4-1.4L16 24.5C20.5 17.5 24 12.8 26.5 14.5Z" />
      <path d="M18.5 22.5l3 1.5M15.5 28l2.5 1.2" opacity=".6" />
      <path d="M26.5 14.5c-1-3-.5-6 1.5-8.5M26.5 14.5c2.5-1.5 5.5-2 8.5-1M26.5 14.5c-.5-2.5-3-5-6-5.5" />
    </svg>
  );
}

/** Glutensiz: buğday başağı + çapraz çizgi */
export function GlutenFreeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M20 35V14" />
      <path d="M20 14c-2.6-1.4-3.4-4-2.4-7 2.6 1.2 3.4 4 2.4 7ZM20 14c2.6-1.4 3.4-4 2.4-7-2.6 1.2-3.4 4-2.4 7Z" />
      <path d="M20 22c-3.6-.4-5.6-2.6-5.8-5.8 3.6.4 5.6 2.6 5.8 5.8ZM20 22c3.6-.4 5.6-2.6 5.8-5.8-3.6.4-5.6 2.6-5.8 5.8Z" />
      <path d="M20 30c-3.6-.4-5.6-2.6-5.8-5.8 3.6.4 5.6 2.6 5.8 5.8ZM20 30c3.6-.4 5.6-2.6 5.8-5.8-3.6.4-5.6 2.6-5.8 5.8Z" />
      <path d="M6 6l28 28" />
    </svg>
  );
}

/** Laktozsuz: süt şişesi + çapraz çizgi */
export function LactoseFreeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M16 5h8M17 5v6c0 1.4-4.5 3-4.5 7v14.5a2.5 2.5 0 0 0 2.5 2.5h10a2.5 2.5 0 0 0 2.5-2.5V18c0-4-4.5-5.6-4.5-7V5" />
      <path d="M12.5 21h15" opacity=".6" />
      <path d="M6 6l28 28" />
    </svg>
  );
}

export const DIET_ICONS: Record<DietTag, ComponentType<SVGProps<SVGSVGElement>>> = {
  VEGAN: VeganIcon,
  VEGETARIAN: VegetarianIcon,
  GLUTEN_FREE: GlutenFreeIcon,
  LACTOSE_FREE: LactoseFreeIcon,
};
