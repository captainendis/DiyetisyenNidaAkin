// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

'use client';

import { RequireAuth } from '@/components/panel/PanelAuth';
import { PanelLayout } from '@/components/panel/PanelLayout';

export default function PanelShell() {
  return (
    <RequireAuth>
      <PanelLayout />
    </RequireAuth>
  );
}
