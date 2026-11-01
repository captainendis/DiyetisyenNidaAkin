// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com
//
// THIRD-PARTY-NOTICES dosyasını package-lock.json'daki üretim bağımlılıklarından üretir.
// Kullanım: npm run notices
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
const rows = [];
for (const [path, pkg] of Object.entries(lock.packages)) {
  if (!path || pkg.dev || pkg.devOptional || pkg.link) continue;
  const name = path.replace(/^.*node_modules\//, '');
  let license = pkg.license;
  const manifest = `${path}/package.json`;
  if (!license && existsSync(manifest)) {
    const m = JSON.parse(readFileSync(manifest, 'utf8'));
    license = typeof m.license === 'string' ? m.license : m.license?.type;
    // Eski biçim: "licenses": [{ type }]
    license ??= Array.isArray(m.licenses) ? m.licenses.map((l) => l.type).join(' OR ') : undefined;
  }
  rows.push({ name, version: pkg.version, license: license ?? 'Belirtilmemiş' });
}
rows.sort((a, b) => a.name.localeCompare(b.name));

const byLicense = {};
for (const r of rows) (byLicense[r.license] ??= []).push(r);

const lines = [
  'ÜÇÜNCÜ TARAF YAZILIM BİLDİRİMLERİ / THIRD-PARTY NOTICES',
  '',
  'Bu yazılım aşağıdaki açık kaynak bileşenleri kullanır. Her bileşen kendi',
  'lisansına tabidir; lisans metinleri ilgili paketin içinde (node_modules/<paket>/LICENSE)',
  've paketin kaynak deposunda yer alır. Bu bildirimler, ana yazılımın',
  '(bkz. LICENSE) mülkiyetini veya lisans koşullarını değiştirmez.',
  '',
  'This software uses the open source components listed below, each under its own',
  'license. License texts ship with each package (node_modules/<package>/LICENSE).',
  '',
  `Bileşen sayısı / Components: ${rows.length}`,
  '',
];
for (const license of Object.keys(byLicense).sort()) {
  lines.push(`== ${license} ==`);
  for (const r of byLicense[license]) lines.push(`  ${r.name} ${r.version}`);
  lines.push('');
}
lines.push('Bu dosya scripts/third-party-notices.mjs ile üretilmiştir; elle düzenlemeyin.');
writeFileSync('THIRD-PARTY-NOTICES', lines.join('\n') + '\n');
console.log(`THIRD-PARTY-NOTICES: ${rows.length} bileşen`);
