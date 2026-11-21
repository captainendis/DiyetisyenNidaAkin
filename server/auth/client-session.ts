// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Danışan oturumu ("Hesabım") — personel oturumundan (session.ts) bilinçli olarak ayrıdır:
 *  - Ayrı tablo (client_sessions), ayrı cookie ("na_csid"). Danışan oturumu c.var.user'ı ASLA doldurmaz;
 *    bu yüzden /api altındaki personel uçlarına (requireAuth/requirePermission) erişemez.
 *  - Aynı güvenlik kuralları: HttpOnly + SameSite=Strict cookie, DB'de yalnızca SHA-256 özeti,
 *    durum değiştiren isteklerde oturuma bağlı CSRF token, şifre değişince eski oturumlar geçersiz.
 *  - Danışan kaydı arşivlenmiş ya da hesap kapatılmışsa oturum düşer.
 *  - Mobil uygulama: cookie yerine "Authorization: Bearer" (bkz. lib/http.ts → isMobileClient).
 */
import { createMiddleware } from 'hono/factory';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { prisma } from '../lib/db';
import { env } from '../lib/env';
import { randomToken, safeEqual, sha256 } from '../lib/crypto';
import { bearerToken, clientIp, forbidden, isMobileClient, unauthorized, userAgent, type AppEnv, type Ctx } from '../lib/http';

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

const cookieOpts = () => ({ httpOnly: true, secure: env.isProd, sameSite: 'Strict' as const, path: '/' });

export async function createClientSession(c: Ctx, accountId: string, rememberMe: boolean) {
  const mobile = isMobileClient(c);
  const remember = rememberMe || mobile;
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
      ip: clientIp(c),
      userAgent: userAgent(c),
    },
  });
  // Mobil uygulama: token yanıt gövdesinde döner (cookie yazılmaz)
  if (mobile) return { token, csrfToken, expiresAt };
  setCookie(c, CLIENT_SESSION_COOKIE, token, { ...cookieOpts(), ...(remember ? { expires: expiresAt } : {}) });
  return { token: null, csrfToken, expiresAt };
}

/** Oturum token'ı: mobilde Authorization: Bearer, tarayıcıda cookie */
const clientSessionToken = (c: Ctx) => bearerToken(c) ?? getCookie(c, CLIENT_SESSION_COOKIE);

export async function destroyClientSession(c: Ctx) {
  const token = clientSessionToken(c);
  if (token) await prisma.clientSession.deleteMany({ where: { tokenHash: sha256(token) } });
  deleteCookie(c, CLIENT_SESSION_COOKIE, cookieOpts());
}

/** Cookie varsa danışan oturumunu çözer ve c.var.portalUser'ı doldurur (zorunlu kılmaz) */
export const loadClientSession = createMiddleware<AppEnv>(async (c, next) => {
  const token = clientSessionToken(c);
  if (!token) return next();
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
  c.set('portalUser', {
    accountId: a.id,
    clientId: a.client.id,
    email: a.email,
    firstName: a.client.firstName,
    lastName: a.client.lastName,
    sessionId: session.id,
    csrfToken: session.csrfToken,
  });
  return next();
});

/** Danışan oturumu zorunlu + durum değiştiren isteklerde CSRF doğrulaması */
export const requireClientAuth = createMiddleware<AppEnv>(async (c, next) => {
  const pu = c.var.portalUser;
  if (!pu) throw unauthorized();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(c.req.method)) {
    const header = c.req.header('x-csrf-token') ?? '';
    if (!header || !safeEqual(header, pu.csrfToken)) {
      throw forbidden('Güvenlik doğrulaması başarısız. Sayfayı yenileyip tekrar deneyin.');
    }
  }
  await next();
});

/** requireClientAuth sonrası danışan (her zaman dolu) */
export function portalUser(c: Ctx): PortalUser {
  const u = c.var.portalUser;
  if (!u) throw unauthorized();
  return u;
}

export async function purgeExpiredClientSessions() {
  await prisma.clientSession.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  await prisma.clientAccountToken.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 864e5) } } });
}
