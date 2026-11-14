// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import '@fontsource-variable/manrope/wght.css';
import '@fontsource-variable/cormorant-garamond/wght.css';
import '@fontsource-variable/cormorant-garamond/wght-italic.css';
import '@/styles/index.css';
import { SiteProvider } from '@/data/SiteContext';
import { getSiteData } from './_lib/site';

// Her istek sunucuda çizilir: CSP nonce'u (proxy.ts) ve panelden değişen içerik için
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Nida Akın — Diyetisyen',
  description: 'Diyetisyen Nida Akın ile kişiye özel, sürdürülebilir beslenme danışmanlığı. Yasaklarla değil, dengeyle.',
  authors: [{ name: 'PaperAxis' }],
  icons: { icon: { url: '/favicon.svg', type: 'image/svg+xml' }, apple: '/apple-touch-icon.png' },
  manifest: '/site.webmanifest',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#211710',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const site = await getSiteData();
  return (
    <html lang="tr">
      <body>
        <SiteProvider initial={site}>{children}</SiteProvider>
      </body>
    </html>
  );
}
