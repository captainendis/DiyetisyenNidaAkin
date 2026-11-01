// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Oturum yönetimi
 *  - Cookie: "na_sid" (HttpOnly, SameSite=Strict, üretimde Secure). Ham token yalnızca cookie'de; DB'de SHA-256 özeti.
 *  - CSRF: oturuma bağlı token. Durum değiştiren her panel isteği "X-CSRF-Token" başlığını taşımalı.
 *    Token, /api/auth/me yanıtında döner (cookie'ye yazılmaz).
 *  - Kayan süre: aktif kullanımda son görülme güncellenir; mutlak süre dolunca oturum biter.
 */
import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../lib/db';
import { env } from '../lib/env';
import { randomToken, safeEqual, sha256 } from '../lib/crypto';
import { forbidden, unauthorized } from '../lib/http';
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

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function createSession(req: Request, res: Response, userId: string, remember: boolean) {
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
      ip: req.ip ?? null,
      userAgent: req.get('user-agent')?.slice(0, 300) ?? null,
    },
  });
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: 'strict',
    path: '/',
    // "Beni hatırla" seçilmediyse tarayıcı oturumu cookie'si (tarayıcı kapanınca silinir)
    ...(remember ? { expires: expiresAt } : {}),
  });
  return { csrfToken };
}

export async function destroySession(req: Request, res: Response) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (token) await prisma.session.deleteMany({ where: { tokenHash: sha256(token) } });
  res.clearCookie(SESSION_COOKIE, { path: '/', httpOnly: true, secure: env.isProd, sameSite: 'strict' });
}

/** Cookie varsa oturumu çözer ve req.user'ı doldurur (zorunlu kılmaz) */
export async function loadSession(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token || typeof token !== 'string') return next();
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
  req.user = {
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    salutation: u.salutation,
    role: u.role.key,
    permissions: u.role.permissions as Permission[],
    sessionId: session.id,
    csrfToken: session.csrfToken,
  };
  next();
}

/** Oturum zorunlu + durum değiştiren isteklerde CSRF doğrulaması */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(unauthorized());
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    const header = req.get('x-csrf-token') ?? '';
    if (!header || !safeEqual(header, req.user.csrfToken)) {
      return next(forbidden('Güvenlik doğrulaması başarısız (CSRF). Sayfayı yenileyip tekrar deneyin.'));
    }
  }
  next();
}

export function requirePermission(...perms: Permission[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthorized());
    const ok = perms.every((p) => req.user!.permissions.includes(p));
    if (!ok) return next(forbidden());
    next();
  };
}

export function can(req: Request, perm: Permission) {
  return !!req.user?.permissions.includes(perm);
}

export async function purgeExpiredSessions() {
  await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  await prisma.passwordResetToken.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 864e5) } } });
}
