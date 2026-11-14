// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Oturum yönetimi
 *  - Cookie: "na_sid" (HttpOnly, SameSite=Strict, üretimde Secure). Ham token yalnızca cookie'de; DB'de SHA-256 özeti.
 *  - CSRF: oturuma bağlı token. Durum değiştiren her panel isteği "X-CSRF-Token" başlığını taşımalı.
 *    Token, /api/auth/me yanıtında döner (cookie'ye yazılmaz).
 *  - Kayan süre: aktif kullanımda son görülme güncellenir; mutlak süre dolunca oturum biter.
 */
import { createMiddleware } from 'hono/factory';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { prisma } from '../lib/db';
import { env } from '../lib/env';
import { randomToken, safeEqual, sha256 } from '../lib/crypto';
import { clientIp, forbidden, unauthorized, userAgent, type AppEnv, type Ctx } from '../lib/http';
import type { Permission } from './permissions';

export const SESSION_COOKIE = 'na_sid';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  salutation: string | null;
  role: 'ADMIN' | 'DIETITIAN' | 'ASSISTANT';
  permissions: Permission[];
  sessionId: string;
  csrfToken: string;
}

export async function createSession(c: Ctx, userId: string, remember: boolean) {
  const token = randomToken(32);
  const csrfToken = randomToken(24);
  const ttlMs = remember ? env.SESSION_REMEMBER_DAYS * 864e5 : env.SESSION_TTL_HOURS * 36e5;
  const expiresAt = new Date(Date.now() + ttlMs);
  await prisma.session.create({
    data: {
      tokenHash: sha256(token),
      csrfToken,
      userId,
      remember,
      expiresAt,
      ip: clientIp(c),
      userAgent: userAgent(c),
    },
  });
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: 'Strict',
    path: '/',
    // "Beni hatırla" seçilmediyse tarayıcı oturumu cookie'si (tarayıcı kapanınca silinir)
    ...(remember ? { expires: expiresAt } : {}),
  });
  return { csrfToken };
}

export async function destroySession(c: Ctx) {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) await prisma.session.deleteMany({ where: { tokenHash: sha256(token) } });
  deleteCookie(c, SESSION_COOKIE, { path: '/', httpOnly: true, secure: env.isProd, sameSite: 'Strict' });
}

/** Cookie varsa oturumu çözer ve c.var.user'ı doldurur (zorunlu kılmaz) */
export const loadSession = createMiddleware<AppEnv>(async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return next();
  const session = await prisma.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: { include: { role: true } } },
  });
  if (!session || session.expiresAt < new Date() || !session.user.isActive) {
    if (session) await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return next();
  }
  // Parola değiştiyse eski oturumlar geçersiz
  if (session.user.passwordChangedAt && session.createdAt < session.user.passwordChangedAt) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return next();
  }
  // Son görülme zamanını en fazla 5 dakikada bir güncelle
  if (Date.now() - session.lastSeenAt.getTime() > 5 * 60_000) {
    await prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } }).catch(() => {});
  }
  const u = session.user;
  c.set('user', {
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    salutation: u.salutation,
    role: u.role.key,
    permissions: u.role.permissions as Permission[],
    sessionId: session.id,
    csrfToken: session.csrfToken,
  });
  return next();
});

/** Oturum zorunlu + durum değiştiren isteklerde CSRF doğrulaması */
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const user = c.var.user;
  if (!user) throw unauthorized();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(c.req.method)) {
    const header = c.req.header('x-csrf-token') ?? '';
    if (!header || !safeEqual(header, user.csrfToken)) {
      throw forbidden('Güvenlik doğrulaması başarısız (CSRF). Sayfayı yenileyip tekrar deneyin.');
    }
  }
  await next();
});

export function requirePermission(...perms: Permission[]) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const user = c.var.user;
    if (!user) throw unauthorized();
    if (!perms.every((p) => user.permissions.includes(p))) throw forbidden();
    await next();
  });
}

export function can(c: Ctx, perm: Permission) {
  return !!c.var.user?.permissions.includes(perm);
}

/** Oturumu zorunlu kılınmış uçlarda personel (requireAuth sonrası her zaman dolu) */
export function authUser(c: Ctx): AuthUser {
  const u = c.var.user;
  if (!u) throw unauthorized();
  return u;
}

export async function purgeExpiredSessions() {
  await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  await prisma.passwordResetToken.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 864e5) } } });
}
