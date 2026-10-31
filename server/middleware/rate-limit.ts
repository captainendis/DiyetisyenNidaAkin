import { rateLimit } from 'express-rate-limit';

const message = (msg: string) => ({ error: { code: 'RATE_LIMITED', message: msg } });

/** Genel API sınırı */
export const apiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: message('Çok fazla istek gönderildi. Lütfen biraz bekleyin.'),
});

/** Giriş denemeleri (IP başına). Hesap bazlı kilit ayrıca server/routes/auth.ts içinde uygulanır. */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: message('Çok fazla giriş denemesi. 15 dakika sonra tekrar deneyin.'),
});

export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60_000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: message('Çok fazla şifre sıfırlama isteği. Bir saat sonra tekrar deneyin.'),
});

/** Web sitesi randevu formu */
export const publicFormLimiter = rateLimit({
  windowMs: 60 * 60_000,
  limit: 8,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: message('Kısa sürede çok fazla talep gönderildi. Lütfen daha sonra tekrar deneyin.'),
});
