// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import type { Metadata } from 'next';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { OutletProvider } from '@/lib/router';
import NotFoundPage from '@/views/NotFoundPage';

export const metadata: Metadata = { title: 'Sayfa bulunamadı', robots: { index: false, follow: false } };

export default function NotFound() {
  return (
    <OutletProvider outlet={<NotFoundPage />}>
      <PublicLayout />
    </OutletProvider>
  );
}
