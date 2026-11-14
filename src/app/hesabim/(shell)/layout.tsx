// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import type { ReactNode } from 'react';
import Shell from '@/views/portal/PortalShell';
import { OutletProvider } from '@/lib/router';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <OutletProvider outlet={children}>
      <Shell />
    </OutletProvider>
  );
}
