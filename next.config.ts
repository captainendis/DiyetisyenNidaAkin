// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import type { NextConfig } from 'next';

/** Tüm yanıtlar için güvenlik başlıkları (CSP, sayfa istekleri için src/proxy.ts'te nonce ile eklenir) */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  { key: 'Origin-Agent-Cluster', value: '?1' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
  ...(process.env.NODE_ENV === 'production' ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }] : []),
];

const nextConfig: NextConfig = {
  // cPanel "Node.js App" için tek klasörlük çıktı: .next/standalone/server.js
  output: 'standalone',
  poweredByHeader: false,
  // Paylaşımlı hostingde süreç sınırı (EAGAIN): derleme tek işçiyle yapılır
  experimental: { cpus: 1 },
  // Dağıtılan sürüm (CI: commit SHA) — /api/health yanıtında döner; dağıtım sonrası doğrulamada kullanılır
  env: { APP_REVISION: process.env.APP_REVISION ?? 'dev' },
  reactStrictMode: true,
  // Sunucuya özgü paketler paketlenmez, node_modules'tan yüklenir
  serverExternalPackages: ['sharp', '@prisma/client', '@prisma/adapter-mariadb', 'mariadb', 'nodemailer'],
  // Çıktıya taşınmaması gerekenler: yüklenen (şifreli) dosyalar, yedekler, belgeler, kaynak/test klasörleri
  outputFileTracingExcludes: {
    // Dikkat: 'dist' gibi genel adlar node_modules/next/dist ile de eşleşir; buraya eklemeyin
    '*': ['./storage/**', './backups/**', './docs/**', './tests/**', './src/**', './assets-src/**', './scripts/**', './prisma/migrations/**', './coverage/**'],
  },
  // Tip denetimi ayrıca yapılır (npm run typecheck)
  typescript: { ignoreBuildErrors: true },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      { source: '/_next/static/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
    ];
  },
};

export default nextConfig;
