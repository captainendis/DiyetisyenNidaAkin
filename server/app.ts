// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * API uygulaması (Hono) — tüm uçlar /api altında.
 *  - Next.js içinde: app/api/[[...path]]/route.ts → api.fetch
 *  - Testlerde: createApp() aynı uygulamayı Node HTTP dinleyicisine çevirir (supertest)
 * Güvenlik başlıkları (CSP vb.) Next.js tarafında uygulanır: proxy.ts ve next.config.ts.
 */
import { Hono } from 'hono';
import { getRequestListener } from '@hono/node-server';
import { ZodError } from 'zod';
import { HttpError, validationError, type AppEnv } from './lib/http';
import { loadSession, requireAuth } from './auth/session';
import { apiLimiter } from './middleware/rate-limit';
import { authRouter } from './routes/auth';
import { publicContentRouter } from './routes/public-content';
import { publicAppointmentsRouter } from './routes/public-appointments';
import { dashboardRouter } from './routes/dashboard';
import { appointmentsRouter } from './routes/appointments';
import { availabilityRouter } from './routes/availability';
import { clientsRouter } from './routes/clients';
import { notificationsRouter } from './routes/notifications';
import { reportsRouter } from './routes/reports';
import { servicesRouter } from './routes/services';
import { contentRouter } from './routes/content';
import { settingsRouter } from './routes/settings';
import { auditRouter } from './routes/audit';
import { plansRouter } from './routes/plans';
import { recipesRouter } from './routes/recipes';
import { portalRouter } from './routes/portal';
import { clientPortalAdminRouter } from './routes/client-portal-admin';
import { classesRouter } from './routes/classes';
import { staffDevicesRouter } from './routes/devices';

/** Oturum + CSRF gerektiren personel uçları */
const STAFF: [string, Hono<AppEnv>][] = [
  ['/dashboard', dashboardRouter],
  ['/appointments', appointmentsRouter],
  ['/availability', availabilityRouter],
  // Danışan hesabı yönetimi (/clients/:id/account, /clients/:id/messages …) — clientsRouter'dan önce
  ['/clients/:id', clientPortalAdminRouter],
  ['/clients', clientsRouter],
  ['/notifications', notificationsRouter],
  ['/reports', reportsRouter],
  ['/services', servicesRouter],
  ['/content', contentRouter],
  ['/settings', settingsRouter],
  ['/audit-logs', auditRouter],
  ['/plans', plansRouter],
  ['/recipes', recipesRouter],
  ['/classes', classesRouter],
  // Mobil anlık bildirim cihaz kaydı (Expo push token)
  ['/devices', staffDevicesRouter],
];

function build() {
  const api = new Hono<AppEnv>().basePath('/api');

  // Ara katmanlar route'lardan ÖNCE kaydedilmeli (Hono kayıt sırasını izler)
  api.use('*', async (c, next) => {
    await next();
    if (!c.res.headers.has('Cache-Control')) c.res.headers.set('Cache-Control', 'no-store');
  });
  api.use('*', apiLimiter);
  api.use('*', loadSession);
  // '/x/*' kalıbı '/x'in kendisini de kapsar
  for (const [prefix] of STAFF) api.use(`${prefix}/*`, requireAuth);

  api.get('/health', (c) => c.json({ ok: true, revision: process.env.APP_REVISION ?? 'dev' }));
  api.route('/auth', authRouter);
  api.route('/public', publicContentRouter);
  api.route('/public', publicAppointmentsRouter);
  // Danışan hesabı (Hesabım): kendi oturumu (na_csid) ve CSRF'i var; personel oturumu gerektirmez, personel uçlarına da erişemez
  api.route('/portal', portalRouter);
  for (const [prefix, r] of STAFF) api.route(prefix, r);

  api.notFound((c) => c.json({ error: { code: 'NOT_FOUND', message: 'Uç nokta bulunamadı' } }, 404));

  api.onError((err, c) => {
    let e: unknown = err;
    if (e instanceof ZodError) e = validationError(e);
    if (e instanceof HttpError) {
      return c.json({ error: { code: e.code, message: e.message, details: e.details } }, e.status as 400);
    }
    console.error(`[${c.req.method} ${c.req.path}]`, e);
    return c.json({ error: { code: 'INTERNAL', message: 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.' } }, 500);
  });

  return api;
}

/** Tekil API uygulaması (Next.js route handler'ı bunu kullanır) */
export const api = build();

/** Node HTTP dinleyicisi — testler (supertest) ve araçlar için */
export function createApp() {
  return getRequestListener(api.fetch);
}
