// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import type { Settings } from '@shared/settings';
import type { ServiceIconKey } from '@shared/constants';

export interface PublicService {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  icon: ServiceIconKey | string;
  imageUrl: string | null;
  durationMinutes: number | null;
  priceCents: number | null;
  sortOrder: number;
}

export interface PublicFaq { id: string; question: string; answer: string }
export interface BlogCategory { id: string; slug: string; name: string }

export interface PostCard {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  publishedAt: string | null;
  readingMinutes: number | null;
  category: { slug: string; name: string } | null;
}

export interface PostDetail extends PostCard {
  content: string;
  seoTitle: string | null;
  metaDescription: string | null;
  updatedAt: string;
  author: { firstName: string; lastName: string } | null;
}

export type PublicSettings = Pick<Settings, 'hero' | 'intro' | 'about' | 'approach' | 'process' | 'cta' | 'contact' | 'social' | 'business' | 'seo' | 'appointment' | 'media'>;

export interface SiteData {
  settings: PublicSettings;
  services: PublicService[];
  faqs: PublicFaq[];
  categories: BlogCategory[];
}
