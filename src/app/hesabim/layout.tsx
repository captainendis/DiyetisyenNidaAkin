// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Root from '@/views/portal/PortalRoot';
import { OutletProvider } from '@/lib/router';

export const metadata: Metadata = { title: { absolute: 'Danışan Hesabım | Nida Akın' }, description: 'Danışanlar için beslenme listeleri, tarifler ve randevular.', robots: { index: false, follow: false } };

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <OutletProvider outlet={children}>
      <Root />
    </OutletProvider>
  );
}
