// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Next.js sunucusu açılırken bir kez çalışır: periyodik işler (oturum temizliği, randevu hatırlatıcıları) */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { startJobs } = await import('../server/jobs');
  startJobs();
}
