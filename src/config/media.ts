// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Site görselleri
 * ───────────────
 * Görseller panelden yönetilir: Panel → Web Sitesi İçeriği → Görseller.
 * Panelde görsel yüklenmemişse aşağıdaki yerleşik mekân fotoğrafları kullanılır
 * (scripts/prepare-images.py ile üretilir). Portre için yerleşik görsel YOKTUR:
 * yüklenene kadar zarif bir yer tutucu gösterilir; stok fotoğraf kullanılmaz.
 */
import { useSite } from '@/data/SiteContext';
import type { SiteImage } from '@shared/settings';

export interface PictureSource {
  base: string;
  widths: readonly number[];
  width: number;
  height: number;
  alt: string;
  /** CSS object-position (ör. "50% 30%") */
  position?: string;
}

export const VENUE = {
  facade: {
    base: '/images/mekan-cephe',
    widths: [480, 668, 1000],
    width: 668,
    height: 828,
    alt: 'Görüşmelerin yapıldığı Pelin Tek Studio Bahçekent’in gece görünümü: siyah doğramalı geniş cam cephe, içeriden yayılan sıcak ışık',
  },
  table: {
    base: '/images/mekan-masa',
    widths: [390, 585],
    width: 390,
    height: 464,
    alt: 'Pelin Tek Studio Bahçekent: cam cephenin ardında ahşap masa ve sandalyeler, sıcak iç aydınlatma',
  },
} as const satisfies Record<string, PictureSource>;

function fromSetting(img: SiteImage | null | undefined): PictureSource | null {
  if (!img) return null;
  return { base: img.base, widths: img.widths, width: img.width, height: img.height, alt: img.alt, position: `${img.focusX ?? 50}% ${img.focusY ?? 50}%` };
}

/** Panelden yüklenen görseller (yoksa yerleşik mekân fotoğrafları); portre yoksa null */
export function useSiteImages() {
  const { site } = useSite();
  const m = site.settings.media;
  return {
    hero: fromSetting(m?.hero) ?? VENUE.facade,
    venue: fromSetting(m?.venue) ?? VENUE.table,
    portrait: fromSetting(m?.portrait),
    /** Kapak fotoğrafı panelden mi geldi? (yerleşik fotoğrafa özgü kırpma ayarlarını atlamak için) */
    heroIsCustom: !!m?.hero,
  };
}
