// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Nida Akın logo sembolü
 * Tek çizgiyle çizilmiş elma silueti; sağ omuzda bilinçli bir "nefes" boşluğu bırakır.
 * Filiz bu boşluğun yanından yükselir — beslenmenin bir kısıtlama değil, büyüme olduğu fikri.
 * İnce kontur, yuvarlak uçlar; tek renk (currentColor).
 */
import type { SVGProps } from 'react';

export const LOGO_PATHS = {
  body: 'M31 19.2C25 14.6 14.2 14.6 10.6 23C6.6 32.2 9.6 45 16.6 52.6C20.6 57 25.6 57.6 29.1 55.6C30.9 54.6 33.1 54.6 34.9 55.6C38.4 57.6 43.4 57 47.4 52.6C54.4 45 57 33.2 53.2 24.6C50.8 19.6 46 17.1 41 17.5',
  stem: 'M32.4 19.6C32.3 15.4 33.3 11.4 35.8 7.8',
  leaf: 'M35 10.4C38.6 4.8 45.8 3.2 51 4.6C48.9 10.8 41.9 13.8 35 10.4Z',
  vein: 'M36.6 9.8C40.8 8.1 44.6 6.6 48.2 5.8',
};

export function LogoMark({ strokeWidth = 1.6, ...props }: SVGProps<SVGSVGElement> & { strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d={LOGO_PATHS.body} />
      <path d={LOGO_PATHS.stem} />
      <path d={LOGO_PATHS.leaf} />
      <path d={LOGO_PATHS.vein} strokeWidth={strokeWidth * 0.7} />
    </svg>
  );
}

/** Yatay logo: sembol + "Nida Akın" + "DİYETİSYEN" */
export function Logo({ className = '', tone = 'light', compact = false }: { className?: string; tone?: 'light' | 'dark'; compact?: boolean }) {
  const color = tone === 'light' ? 'text-cream' : 'text-espresso';
  return (
    <span className={`inline-flex items-center gap-3 ${color} ${className}`}>
      <LogoMark className={`${compact ? 'h-9 w-9' : 'h-11 w-11 sm:h-12 sm:w-12'} shrink-0 text-rose`} strokeWidth={1.5} />
      <span className="flex flex-col leading-none">
        <span className={`font-display font-medium tracking-[0.01em] ${compact ? 'text-[1.45rem]' : 'text-[1.6rem] sm:text-[1.8rem]'}`}>Nida Akın</span>
        <span className={`mt-1.5 text-[0.6rem] font-medium tracking-[0.42em] uppercase ${tone === 'light' ? 'text-cream/75' : 'text-taupe'}`}>Diyetisyen</span>
      </span>
    </span>
  );
}
