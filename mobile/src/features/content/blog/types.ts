// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import type { Tone } from '@/theme';
import type { PostStatus } from '@shared/constants';

export interface PostRow {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  status: PostStatus;
  expertReviewed: boolean;
  publishedAt: string | null;
  updatedAt: string;
  coverImageUrl: string | null;
  readingMinutes: number | null;
  category: { id: string; name: string; slug: string } | null;
}

export interface Post {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  categoryId: string | null;
  seoTitle: string | null;
  metaDescription: string | null;
  expertReviewed: boolean;
  status: PostStatus;
  publishedAt: string | null;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  _count?: { posts: number };
}

export const POST_TONE: Record<PostStatus, Tone> = { DRAFT: 'neutral', PUBLISHED: 'success', UNPUBLISHED: 'warning' };

/** Tahmini okuma süresi (sunucu ile aynı: 200 kelime/dk) */
export function readingMinutes(content: string) {
  return Math.max(1, Math.round(content.split(/\s+/).filter(Boolean).length / 200));
}
