// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import type { SVGProps } from 'react';

const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', viewBox: '0 0 24 24', 'aria-hidden': true } as const;

export function InstagramIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.3" cy="6.7" r=".6" fill="currentColor" />
    </svg>
  );
}
export function YoutubeIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4a2.5 2.5 0 0 0-1.8 1.8C2 8.8 2 12 2 12s0 3.2.4 4.8a2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8c.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8Z" />
      <path d="m10 15 5-3-5-3v6Z" />
    </svg>
  );
}
export function XIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <path d="M4 4l16 16M20 4 4 20" strokeWidth={1.4} />
    </svg>
  );
}
export function LinkedinIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M8 10.5V16M8 7.5v.01M12 16v-5.5M12 13c0-1.5 1-2.5 2.3-2.5S16.5 11.5 16.5 13v3" />
    </svg>
  );
}
export function WhatsappIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...p}>
      <path d="M20.5 11.6a8.5 8.5 0 0 1-12.6 7.5L3.5 20.5l1.4-4.2A8.5 8.5 0 1 1 20.5 11.6Z" />
      <path d="M9 8.6c.2-.4.5-.5.8-.5h.5c.2 0 .4.1.5.4l.7 1.7c.1.2 0 .5-.1.6l-.6.7a6 6 0 0 0 2.8 2.7l.7-.6c.2-.2.4-.2.6-.1l1.7.8c.2.1.3.3.3.5v.5c0 .3-.2.6-.5.8-.7.4-1.6.5-2.6.1a9 9 0 0 1-4.6-4.6c-.4-1-.3-2 .2-2.9Z" />
    </svg>
  );
}
