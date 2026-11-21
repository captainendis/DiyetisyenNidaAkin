// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import { prisma } from '../lib/db';
import { env } from '../lib/env';
import { burnPasswordCheck, hashPassword, randomToken, sha256, verifyPassword } from '../lib/crypto';
import { body, HttpError, parse, router, unauthorized } from '../lib/http';
import { audit } from '../lib/audit';
import { changePasswordSchema, forgotPasswordSchema, loginSchema, resetPasswordSchema } from '../../shared/schemas';
import { authUser, createSession, destroySession, requireAuth } from '../auth/session';
import { loginLimiter, passwordResetLimiter } from '../middleware/rate-limit';
import { isEmailConfigured, sendMail } from '../services/mailer';

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;
const RESET_TTL_MIN = 30;

export const authRouter = router();

authRouter.post('/login', loginLimiter, async (c) => {
  const { email, password, remember } = parse(loginSchema, await body(c));
  const user = await prisma.user.findUnique({ where: { email }, include: { role: true } });
  const generic = new HttpError(401, 'INVALID_CREDENTIALS', 'E-posta adresi veya şifre hatalı');

  if (!user || !user.isActive) {
    await burnPasswordCheck(password);
    await audit(c, 'auth.login_failed', 'user', null, { reason: 'unknown_or_inactive' });
    throw generic;
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const mins = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
    throw new HttpError(423, 'ACCOUNT_LOCKED', `Çok sayıda hatalı deneme nedeniyle hesap geçici olarak kilitlendi. ${mins} dakika sonra tekrar deneyin.`);
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    const failed = user.failedLoginCount + 1;
    const lock = failed >= MAX_FAILED;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: lock ? 0 : failed,
        lockedUntil: lock ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
      },
    });
    await audit(c, lock ? 'auth.account_locked' : 'auth.login_failed', 'user', user.id);
    throw generic;
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
  });
  const session = await createSession(c, user.id, remember);
  // Oturum bu istekte henüz yüklenmedi; denetim kaydı için kullanıcıyı geçici olarak bağla
  c.set('user', { id: user.id } as never);
  await audit(c, 'auth.login', 'user', user.id, { remember, mobile: !!session.token });
  c.set('user', undefined);
  // Mobil uygulama: ham token + CSRF yalnızca burada bir kez döner
  return c.json(session.token ? { ok: true, token: session.token, csrfToken: session.csrfToken, expiresAt: session.expiresAt.toISOString() } : { ok: true });
});

authRouter.post('/logout', async (c) => {
  const current = c.var.user;
  if (current) await audit(c, 'auth.logout', 'user', current.id);
  await destroySession(c);
  return c.json({ ok: true });
});

authRouter.get('/me', (c) => {
  const current = c.var.user;
  if (!current) throw unauthorized();
  const { sessionId: _s, ...user } = current;
  return c.json({ user, demoMode: env.DEMO_MODE });
});

authRouter.post('/forgot-password', passwordResetLimiter, async (c) => {
  const { email } = parse(forgotPasswordSchema, await body(c));
  const user = await prisma.user.findUnique({ where: { email } });
  // Kullanıcının var olup olmadığı yanıttan anlaşılmamalı
  const emailConfigured = await isEmailConfigured();
  const response = {
    ok: true,
    emailConfigured,
    message: emailConfigured
      ? 'Bu adrese kayıtlı bir hesap varsa şifre sıfırlama bağlantısı gönderildi.'
      : 'E-posta gönderimi henüz yapılandırılmadı. Şifrenizi sıfırlamak için sistem yöneticinize başvurun (README → "Şifre sıfırlama").',
  };
  if (!user || !user.isActive) return c.json(response);

  const token = randomToken(32);
  await prisma.passwordResetToken.create({
    data: { tokenHash: sha256(token), userId: user.id, expiresAt: new Date(Date.now() + RESET_TTL_MIN * 60_000) },
  });
  const link = `${env.publicSiteUrl}/panel/sifre-sifirla?token=${token}`;
  await audit(c, 'auth.password_reset_requested', 'user', user.id);
  if (emailConfigured) {
    await sendMail({
      to: user.email,
      subject: 'Şifre sıfırlama — Nida Akın Panel',
      text: `Merhaba,\n\nŞifrenizi sıfırlamak için aşağıdaki bağlantıyı ${RESET_TTL_MIN} dakika içinde kullanın:\n${link}\n\nBu isteği siz yapmadıysanız bu e-postayı yok sayabilirsiniz.`,
    });
  } else if (!env.isProd) {
    // Yalnızca geliştirme ortamında: bağlantı sunucu konsoluna yazılır
    console.info(`\n[DEV] Şifre sıfırlama bağlantısı (${user.email}):\n${link}\n`);
  }
  return c.json(response);
});

authRouter.post('/reset-password', passwordResetLimiter, async (c) => {
  const { token, password } = parse(resetPasswordSchema, await body(c));
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw new HttpError(400, 'INVALID_TOKEN', 'Bağlantı geçersiz veya süresi dolmuş. Yeni bir sıfırlama isteği oluşturun.');
  }
  const passwordHash = await hashPassword(password);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash, passwordChangedAt: new Date(), failedLoginCount: 0, lockedUntil: null },
    }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.session.deleteMany({ where: { userId: record.userId } }),
  ]);
  await audit(c, 'auth.password_reset', 'user', record.userId);
  return c.json({ ok: true });
});

authRouter.post('/change-password', requireAuth, async (c) => {
  const { currentPassword, newPassword } = parse(changePasswordSchema, await body(c));
  const user = await prisma.user.findUniqueOrThrow({ where: { id: authUser(c).id } });
  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new HttpError(422, 'VALIDATION_ERROR', 'Mevcut şifre hatalı', { fields: { currentPassword: 'Mevcut şifre hatalı' } });
  }
  const passwordHash = await hashPassword(newPassword);
  // passwordChangedAt'ten önce oluşturulan tüm oturumlar geçersiz olur → mevcut oturumu yeniden oluştur
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash, passwordChangedAt: new Date() } });
  await prisma.session.deleteMany({ where: { userId: user.id } });
  const { csrfToken, token } = await createSession(c, user.id, false);
  await audit(c, 'auth.password_changed', 'user', user.id);
  // Tüm oturumlar kapandı; mobil uygulama yeni token'ı saklar
  return c.json(token ? { ok: true, csrfToken, token } : { ok: true, csrfToken });
});
