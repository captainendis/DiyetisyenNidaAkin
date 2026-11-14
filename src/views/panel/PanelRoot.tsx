// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

'use client';

import { Outlet } from '@/lib/router';
import { PanelAuthProvider } from '@/components/panel/PanelAuth';

/** /panel altındaki tüm sayfalar (giriş dahil) için kimlik bağlamı */
export default function PanelRoot() {
  return (
    <PanelAuthProvider>
      <Outlet />
    </PanelAuthProvider>
  );
}
