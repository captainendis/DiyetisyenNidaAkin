// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * `next build` sonrası: standalone çıktıya statik dosyaları ekler. Sonuç (.next/standalone) tek başına çalışır:
 *   node .next/standalone/server.js
 * Next.js public/ ve .next/static klasörlerini standalone'a kendisi kopyalamaz.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, '.next', 'standalone');
if (!fs.existsSync(path.join(out, 'server.js'))) {
  console.error('✖ .next/standalone/server.js yok — önce `next build` çalışmalı');
  process.exit(1);
}
fs.cpSync(path.join(root, 'public'), path.join(out, 'public'), { recursive: true });
fs.cpSync(path.join(root, '.next', 'static'), path.join(out, '.next', 'static'), { recursive: true });
console.log('✓ Standalone çıktı hazır: .next/standalone (public + .next/static eklendi)');
