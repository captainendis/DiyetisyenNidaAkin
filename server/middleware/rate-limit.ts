// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * İstek sınırlayıcı (IP başına, sabit pencere, bellek içi).
 * Uygulama tek süreçte çalışır (cPanel Node.js App / `next start`); birden çok süreçte her süreç kendi sayacını tutar.
 * Yanıt başlıkları IETF taslak-7 biçimindedir (RateLimit, RateLimit-Policy).
 */
import { createMiddleware } from 'hono/factory';
import { clientIp, type AppEnv } from '../lib/http';

interface Options {
  windowMs: number;
  limit: number;
  message: string;
}

const message = (msg: string) => ({ error: { code: 'RATE_LIMITED', message: msg } });

export function rateLimit(opts: Options) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  let sweepAt = Date.now() + opts.windowMs;

  return createMiddleware<AppEnv>(async (c, next) => {
    const now = Date.now();
    // Süresi dolan kayıtları ara sıra temizle (bellek büyümesin)
    if (now > sweepAt) {
      for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
      sweepAt = now + opts.windowMs;
    }
    const key = clientIp(c) ?? 'unknown';
    let h = hits.get(key);
    if (!h || h.resetAt <= now) {
      h = { count: 0, resetAt: now + opts.windowMs };
      hits.set(key, h);
    }
    h.count += 1;
    const remaining = Math.max(0, opts.limit - h.count);
    const resetSec = Math.ceil((h.resetAt - now) / 1000);
    c.header('RateLimit-Policy', `${opts.limit};w=${Math.round(opts.windowMs / 1000)}`);
    c.header('RateLimit', `limit=${opts.limit}, remaining=${remaining}, reset=${resetSec}`);
    if (h.count > opts.limit) {
      c.header('Retry-After', String(resetSec));
      return c.json(message(opts.message), 429);
    }
    await next();
  });
}

/** Genel API sınırı */
export const apiLimiter = rateLimit({ windowMs: 60_000, limit: 300, message: 'Çok fazla istek gönderildi. Lütfen biraz bekleyin.' });

/** Giriş denemeleri (IP başına). Hesap bazlı kilit ayrıca server/routes/auth.ts içinde uygulanır. */
export const loginLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 20, message: 'Çok fazla giriş denemesi. 15 dakika sonra tekrar deneyin.' });

export const passwordResetLimiter = rateLimit({ windowMs: 60 * 60_000, limit: 5, message: 'Çok fazla şifre sıfırlama isteği. Bir saat sonra tekrar deneyin.' });

/** Web sitesi randevu formu */
export const publicFormLimiter = rateLimit({ windowMs: 60 * 60_000, limit: 8, message: 'Kısa sürede çok fazla talep gönderildi. Lütfen daha sonra tekrar deneyin.' });
