// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Görsel işleme (sharp)
 *  - EXIF yönlendirmesi uygulanır, ardından TÜM meta veriler (konum/GPS, cihaz bilgisi) silinir.
 *  - Site görselleri için birden çok genişlikte AVIF + WebP varyant üretilir:
 *      /uploads/public/site/<id>-<genişlik>.webp|.avif
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { PUBLIC_UPLOADS } from '../lib/storage';

export const SITE_DIR = path.join(PUBLIC_UPLOADS, 'site');
const TARGET_WIDTHS = [480, 960, 1600, 2200];

/** Çok büyük/bozuk dosyalarda sharp'ın tükettiği belleği sınırla (~60 MP) */
const input = (buf: Buffer) => sharp(buf, { limitInputPixels: 60_000_000, failOn: 'error' }).rotate();

export async function processSiteImage(buf: Buffer) {
  const meta = await input(buf).metadata();
  // rotate() sonrası boyutlar: 90/270 derece EXIF yönlendirmesinde en/boy yer değiştirir
  const swap = (meta.orientation ?? 1) >= 5;
  const srcW = (swap ? meta.height : meta.width) ?? 0;
  const srcH = (swap ? meta.width : meta.height) ?? 0;
  if (srcW < 400 || srcH < 400) throw new Error('TOO_SMALL');

  let widths = TARGET_WIDTHS.filter((w) => w < srcW);
  if (!widths.length || srcW < 2200) widths = [...widths, Math.min(srcW, 2200)];
  widths = [...new Set(widths)].sort((a, b) => a - b);

  await fs.mkdir(SITE_DIR, { recursive: true });
  const id = crypto.randomBytes(10).toString('hex');
  for (const w of widths) {
    const pipe = input(buf).resize({ width: w, withoutEnlargement: true });
    await pipe.clone().webp({ quality: 80 }).toFile(path.join(SITE_DIR, `${id}-${w}.webp`));
    await pipe.clone().avif({ quality: 55, effort: 4 }).toFile(path.join(SITE_DIR, `${id}-${w}.avif`));
  }
  const maxW = widths[widths.length - 1]!;
  return {
    id,
    base: `/uploads/public/site/${id}`,
    widths,
    width: maxW,
    height: Math.round((srcH / srcW) * maxW),
  };
}

export async function deleteSiteImage(base: string) {
  const id = path.basename(base);
  if (!/^[a-f0-9]{20}$/.test(id)) return;
  const files = await fs.readdir(SITE_DIR).catch(() => [] as string[]);
  await Promise.all(files.filter((f) => f.startsWith(`${id}-`)).map((f) => fs.unlink(path.join(SITE_DIR, f)).catch(() => {})));
}

/** Blog vb. tekil görseller: meta veriyi sil, en fazla 2000 px, WebP */
export async function sanitizeImage(buf: Buffer) {
  return input(buf).resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
}
