/**
 * Dosya depolama yolları ve güvenli yükleme yardımcıları.
 *  - public/  : herkese açık blog görselleri (/uploads/public/...)
 *  - private/ : danışan dosyaları — AES-256-GCM ile şifreli; ASLA statik servis edilmez, yalnızca yetkili uçtan indirilir.
 */
import fs from 'node:fs';
import path from 'node:path';
import { env } from './env';

export const UPLOAD_ROOT = path.resolve(env.UPLOAD_DIR);
export const PUBLIC_UPLOADS = path.join(UPLOAD_ROOT, 'public');
export const PRIVATE_UPLOADS = path.join(UPLOAD_ROOT, 'private');
for (const dir of [PUBLIC_UPLOADS, PRIVATE_UPLOADS]) fs.mkdirSync(dir, { recursive: true });

/** Dosya içeriğinin ilk baytlarından gerçek türü belirler (uzantıya/istemci MIME'ına güvenilmez) */
export function sniffMime(buf: Buffer): 'image/jpeg' | 'image/png' | 'image/webp' | 'image/avif' | 'application/pdf' | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  if (buf.subarray(4, 12).toString('ascii').startsWith('ftypavi')) return 'image/avif';
  if (buf.subarray(0, 5).toString('ascii') === '%PDF-') return 'application/pdf';
  return null;
}

export const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'application/pdf': 'pdf',
};
