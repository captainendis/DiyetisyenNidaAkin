/**
 * Herkese açık site içeriği. Panelden yönetilen içerik /api/public/site'tan gelir.
 * API'ye ulaşılamazsa (ör. yalnızca statik önizleme) shared/ varsayılanlarıyla çizilir — site asla boş görünmez.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '@/lib/api';
import { defaultSettings } from '@shared/settings';
import { seedServices, seedFaqs } from '@shared/seed-content';
import { DEFAULT_BLOG_CATEGORIES } from '@shared/constants';
import type { SiteData } from './types';

export const fallbackSite: SiteData = {
  settings: defaultSettings,
  services: seedServices.map((s, i) => ({ ...s, id: s.slug, imageUrl: null, durationMinutes: null, priceCents: null, sortOrder: i })),
  faqs: seedFaqs.filter((f) => f.isPublished).map((f, i) => ({ id: String(i), question: f.question, answer: f.answer })),
  categories: DEFAULT_BLOG_CATEGORIES.map((c) => ({ id: c.slug, ...c })),
};

const Ctx = createContext<{ site: SiteData; ready: boolean }>({ site: fallbackSite, ready: false });

export function SiteProvider({ children }: { children: ReactNode }) {
  const [site, setSite] = useState<SiteData>(fallbackSite);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    api
      .get<SiteData>('/public/site')
      .then(setSite)
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);
  return <Ctx.Provider value={{ site, ready }}>{children}</Ctx.Provider>;
}

export function useSite() {
  return useContext(Ctx);
}
