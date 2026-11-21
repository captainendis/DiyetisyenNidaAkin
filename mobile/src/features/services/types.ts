// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Hizmet (panel) — sunucudaki Service modeli (server/routes/services.ts) */
export interface Service {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  icon: string;
  imageUrl: string | null;
  isPublished: boolean;
  sortOrder: number;
  durationMinutes: number | null;
  priceCents: number | null;
  showPrice: boolean;
  createdAt: string;
  updatedAt: string;
}

export const serviceKeys = { list: ['services'] as const };
