// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Herkese açık site verisi (ayarlar, hizmetler, SSS, kategoriler) — sunucuda ilk HTML için okunur */
import 'server-only';
import { cache } from 'react';
import { api } from '../../../server/app';
import type { SiteData } from '@/data/types';

/** /api/public/site ile aynı veri; API uygulaması süreç içinde çağrılır (ağ isteği yok) */
export const getSiteData = cache(async (): Promise<SiteData | null> => {
  try {
    const res = await api.request('/api/public/site');
    return res.ok ? ((await res.json()) as SiteData) : null;
  } catch (e) {
    console.error('Site verisi okunamadı', e);
    return null;
  }
});
