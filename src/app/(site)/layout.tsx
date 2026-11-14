// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import type { ReactNode } from 'react';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { OutletProvider } from '@/lib/router';

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <OutletProvider outlet={children}>
      <PublicLayout />
    </OutletProvider>
  );
}
