// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Herkese açık yüklemeler (blog/tarif/site görselleri) — UPLOAD_DIR/public altından. Özel dosyalar ASLA buradan servis edilmez.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { PUBLIC_UPLOADS } from '../../../../../server/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TYPES: Record<string, string> = {
  '.webp': 'image/webp', '.avif': 'image/avif', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.gif': 'image/gif',
};

export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const parts = (await params).path;
  const root = path.resolve(PUBLIC_UPLOADS);
  const file = path.resolve(root, ...parts.map((p) => decodeURIComponent(p)));
  // Dizin dışına çıkma (../) engeli
  if (!file.startsWith(root + path.sep)) return new Response('Not found', { status: 404 });
  const type = TYPES[path.extname(file).toLowerCase()];
  if (!type) return new Response('Not found', { status: 404 });
  try {
    const buf = await fs.readFile(file);
    return new Response(new Uint8Array(buf), {
      headers: {
        'Content-Type': type,
        'Content-Length': String(buf.length),
        'Cache-Control': 'public, max-age=2592000',
        'X-Content-Type-Options': 'nosniff',
        ...(type === 'image/svg+xml' ? { 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'" } : {}),
      },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
