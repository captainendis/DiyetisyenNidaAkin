/** Express uygulaması — API, statik dosyalar ve SPA servisi */
import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { ZodError } from 'zod';
import { env } from './lib/env';
import { HttpError, validationError } from './lib/http';
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
import { registerSeo } from './seo';
import { PUBLIC_UPLOADS } from './lib/storage';


export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (env.TRUST_PROXY) app.set('trust proxy', env.TRUST_PROXY);

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'"],
          'style-src': ["'self'", "'unsafe-inline'"],
          'img-src': ["'self'", 'data:', 'blob:'],
          'font-src': ["'self'", 'data:'],
          'frame-src': ['https://www.google.com'],
          'connect-src': ["'self'"],
          'form-action': ["'self'"],
          'frame-ancestors': ["'none'"],
          'upgrade-insecure-requests': env.isProd ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );
  app.use(compression());
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));

  // ── API ──
  const api = express.Router();
  api.use(apiLimiter);
  api.use(loadSession);
  api.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  api.get('/health', (_req, res) => res.json({ ok: true }));
  api.use('/auth', authRouter);
  api.use('/public', publicContentRouter);
  api.use('/public', publicAppointmentsRouter);
  // Bundan sonraki tüm uçlar oturum + CSRF gerektirir
  api.use(requireAuth);
  api.use('/dashboard', dashboardRouter);
  api.use('/appointments', appointmentsRouter);
  api.use('/availability', availabilityRouter);
  api.use('/clients', clientsRouter);
  api.use('/notifications', notificationsRouter);
  api.use('/reports', reportsRouter);
  api.use('/services', servicesRouter);
  api.use('/content', contentRouter);
  api.use('/settings', settingsRouter);
  api.use('/audit-logs', auditRouter);
  api.use((_req, _res, next) => next(new HttpError(404, 'NOT_FOUND', 'Uç nokta bulunamadı')));
  app.use('/api', api);

  // ── Herkese açık yüklemeler (blog görselleri). Özel dosyalar ASLA statik servis edilmez. ──
  app.use(
    '/uploads/public',
    express.static(PUBLIC_UPLOADS, {
      maxAge: '30d',
      setHeaders: (res) => res.set('X-Content-Type-Options', 'nosniff'),
    }),
  );

  // ── SEO (robots, sitemap) + üretimde SPA ──
  registerSeo(app);

  // ── Hata yakalayıcı ──
  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    let e = err;
    if (e instanceof ZodError) e = validationError(e);
    if (e instanceof HttpError) {
      return res.status(e.status).json({ error: { code: e.code, message: e.message, details: e.details } });
    }
    if ((e as { type?: string })?.type === 'entity.too.large') {
      return res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'İstek çok büyük' } });
    }
    console.error(`[${req.method} ${req.originalUrl}]`, e);
    res.status(500).json({ error: { code: 'INTERNAL', message: 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.' } });
  });

  return app;
}
