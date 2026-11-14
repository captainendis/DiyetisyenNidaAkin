// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Periyodik işler: süresi dolan oturumlar ve yaklaşan randevu hatırlatıcıları.
 * Next.js sunucusu açılırken src/instrumentation.ts tarafından bir kez başlatılır.
 */
import { prisma } from './lib/db';
import { purgeExpiredSessions } from './auth/session';
import { purgeExpiredClientSessions } from './auth/client-session';
import { generateUpcomingReminders } from './services/notifications';

let started = false;

export function startJobs() {
  if (started) return;
  started = true;
  const jobs = setInterval(() => {
    purgeExpiredSessions().catch((e) => console.error('session purge', e));
    purgeExpiredClientSessions().catch((e) => console.error('client session purge', e));
    generateUpcomingReminders().catch((e) => console.error('reminders', e));
  }, 5 * 60_000);
  jobs.unref();
  setTimeout(() => generateUpcomingReminders().catch(() => {}), 5_000).unref();

  const shutdown = async () => {
    clearInterval(jobs);
    await prisma.$disconnect().catch(() => {});
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}
