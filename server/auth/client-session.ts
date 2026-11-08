// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Danışan oturumu ("Hesabım") — personel oturumundan (session.ts) bilinçli olarak ayrıdır:
 *  - Ayrı tablo (client_sessions), ayrı cookie ("na_csid"). Danışan oturumu req.user'ı ASLA doldurmaz;
 *    bu yüzden /api altındaki personel uçlarına (requireAuth/requirePermission) erişemez.
 *  - Aynı güvenlik kuralları: HttpOnly + SameSite=Strict cookie, DB'de yalnızca SHA-256 özeti,
 *    durum değiştiren isteklerde oturuma bağlı CSRF token, şifre değişince eski oturumlar geçersiz.
 *  - Danışan kaydı arşivlenmiş ya da hesap kapatılmışsa oturum düşer.
 */
import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../lib/db';
import { env } from '../lib/env';
import { randomToken, safeEqual, sha256 } from '../lib/crypto';
import { forbidden, unauthorized } from '../lib/http';

export const CLIENT_SESSION_COOKIE = 'na_csid';

export interface PortalUser {
  accountId: string;
  clientId: string;
  email: string;
  firstName: string;
  lastName: string;
  sessionId: string;
  csrfToken: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      portalUser?: PortalUser;
    }
  }
}

const cookieOpts = () => ({ httpOnly: true, secure: env.isProd, sameSite: 'strict' as const, path: '/' });

export async function createClientSession(req: Request, res: Response, accountId: string, remember: boolean) {
  const token = randomToken(32);
  const csrfToken = randomToken(24);
  const ttlMs = remember ? env.SESSION_REMEMBER_DAYS * 864e5 : env.SESSION_TTL_HOURS * 36e5;
  const expiresAt = new Date(Date.now() + ttlMs);
  await prisma.clientSession.create({
    data: {
      tokenHash: sha256(token),
      csrfToken,
      accountId,
      remember,
      expiresAt,
      ip: req.ip ?? null,
      userAgent: req.get('user-agent')?.slice(0, 300) ?? null,
    },
  });
  res.cookie(CLIENT_SESSION_COOKIE, token, { ...cookieOpts(), ...(remember ? { expires: expiresAt } : {}) });
}

export async function destroyClientSession(req: Request, res: Response) {
  const token = req.cookies?.[CLIENT_SESSION_COOKIE];
  if (token && typeof token === 'string') await prisma.clientSession.deleteMany({ where: { tokenHash: sha256(token) } });
  res.clearCookie(CLIENT_SESSION_COOKIE, cookieOpts());
}

/** Cookie varsa danışan oturumunu çözer ve req.portalUser'ı doldurur (zorunlu kılmaz) */
export async function loadClientSession(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[CLIENT_SESSION_COOKIE];
  if (!token || typeof token !== 'string') return next();
  const session = await prisma.clientSession.findUnique({
    where: { tokenHash: sha256(token) },
    include: { account: { include: { client: { select: { id: true, firstName: true, lastName: true, status: true } } } } },
  });
  const a = session?.account;
  const invalid =
    !session ||
    !a ||
    session.expiresAt < new Date() ||
    !a.isActive ||
    !a.passwordHash ||
    a.client.status === 'ARCHIVED' ||
    (a.passwordChangedAt && session.createdAt < a.passwordChangedAt);
  if (invalid) {
    if (session) await prisma.clientSession.delete({ where: { id: session.id } }).catch(() => {});
    return next();
  }
  if (Date.now() - session.lastSeenAt.getTime() > 5 * 60_000) {
    await prisma.clientSession.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } }).catch(() => {});
  }
  req.portalUser = {
    accountId: a.id,
    clientId: a.client.id,
    email: a.email,
    firstName: a.client.firstName,
    lastName: a.client.lastName,
    sessionId: session.id,
    csrfToken: session.csrfToken,
  };
  next();
}

/** Danışan oturumu zorunlu + durum değiştiren isteklerde CSRF doğrulaması */
export function requireClientAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.portalUser) return next(unauthorized());
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    const header = req.get('x-csrf-token') ?? '';
    if (!header || !safeEqual(header, req.portalUser.csrfToken)) {
      return next(forbidden('Güvenlik doğrulaması başarısız. Sayfayı yenileyip tekrar deneyin.'));
    }
  }
  next();
}

export async function purgeExpiredClientSessions() {
  await prisma.clientSession.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  await prisma.clientAccountToken.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 864e5) } } });
}
