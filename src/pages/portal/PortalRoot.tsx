// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import { Outlet } from 'react-router';
import { PortalAuthProvider } from '@/components/portal/PortalAuth';

/** /hesabim altındaki tüm sayfalar (giriş dahil) için danışan kimlik bağlamı */
export default function PortalRoot() {
  return (
    <PortalAuthProvider>
      <Outlet />
    </PortalAuthProvider>
  );
}
