// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Sayfa istekleri için içerik güvenlik politikası (CSP): her istekte yeni bir nonce üretilir; Next.js kendi
 * betiklerine bu nonce'u ekler. Satır içi/dış kaynaklı başka betik çalışamaz. (Eski Express/helmet CSP'sinin karşılığı.)
 * /api yanıtları kendi başlıklarını taşır (ör. yazdırma sayfasının ayrı CSP'si) ve burada değiştirilmez.
 */
import { NextResponse, type NextRequest } from 'next/server';

export function proxy(req: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const dev = process.env.NODE_ENV !== 'production';
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    'frame-src https://www.google.com',
    `connect-src 'self'${dev ? ' ws: wss:' : ''}`,
    "form-action 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
    ...(dev ? [] : ['upgrade-insecure-requests']),
  ].join('; ');

  const headers = new Headers(req.headers);
  headers.set('x-nonce', nonce);
  headers.set('content-security-policy', csp);
  const res = NextResponse.next({ request: { headers } });
  res.headers.set('Content-Security-Policy', csp);
  return res;
}

export const config = {
  matcher: [
    // API, Next.js varlıkları, yüklemeler ve statik dosyalar hariç tüm sayfalar
    { source: '/((?!api/|_next/static|_next/image|uploads/|favicon|apple-touch-icon|icon-|logo|og-image|site.webmanifest|images/|robots.txt|sitemap.xml).*)' },
  ],
};
