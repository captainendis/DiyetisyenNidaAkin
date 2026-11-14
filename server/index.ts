// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import { createApp } from './app';
import { env } from './lib/env';
import { prisma } from './lib/db';
import { purgeExpiredSessions } from './auth/session';
import { purgeExpiredClientSessions } from './auth/client-session';
import { generateUpcomingReminders } from './services/notifications';

const app = createApp();
const server = app.listen(env.PORT, () => {
  console.log(`✓ API http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

// Periyodik işler: süresi dolan oturumlar ve yaklaşan randevu hatırlatıcıları
const jobs = setInterval(() => {
  purgeExpiredSessions().catch((e) => console.error('session purge', e));
  purgeExpiredClientSessions().catch((e) => console.error('client session purge', e));
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
