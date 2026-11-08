// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import { createApp } from './app';
import { env } from './lib/env';
import { prisma } from './lib/db';
import { purgeExpiredSessions } from './auth/session';
import { generateUpcomingReminders } from './services/notifications';
import { encryptLegacyVariantNotes } from './services/recipe-notes';
import { encryptLegacyRecipeContent } from './services/recipe-content';

// Tek seferlik veri taşımaları (idempotent): eski kurulumlardaki düz metin tarif içeriğini ve varyasyon
// notlarını şifrele, düz metin sütunlarını kaldır. Sunucu istek almaya başlamadan önce tamamlanır ki
// taşıma sürerken tarifler boş görünmesin. Hata olursa sunucu yine açılır (veri kaybı yok; sonraki açılışta tekrar denenir).
try {
  const c = await encryptLegacyRecipeContent();
  if (c) console.log(`✓ ${c} tarifin içeriği şifrelendi`);
  const n = await encryptLegacyVariantNotes();
  if (n) console.log(`✓ ${n} tarif varyasyon notu şifrelendi`);
} catch (e) {
  console.error('Tarif verileri şifrelenemedi', e);
}

const app = createApp();
const server = app.listen(env.PORT, () => {
  console.log(`✓ API http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

// Periyodik işler: süresi dolan oturumlar ve yaklaşan randevu hatırlatıcıları
const jobs = setInterval(() => {
  purgeExpiredSessions().catch((e) => console.error('session purge', e));
  generateUpcomingReminders().catch((e) => console.error('reminders', e));
}, 5 * 60_000);
setTimeout(() => generateUpcomingReminders().catch(() => {}), 5_000);


async function shutdown() {
  clearInterval(jobs);
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
