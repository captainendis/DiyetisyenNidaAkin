// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Danışan hesabı yardımcıları: tek kullanımlık bağlantı üretimi, e-posta, panel için hesap özeti */
import type { ClientAccount, ClientTokenPurpose } from '../generated/prisma/client';
import { prisma } from '../lib/db';
import { env } from '../lib/env';
import { randomToken, sha256 } from '../lib/crypto';
import { isEmailConfigured, sendMail } from './mailer';
import { ACTIVATION_TTL_HOURS, RESET_TTL_MINUTES, type PortalAccountInfo, type PortalLinkResult } from '../../shared/portal';

const PATH: Record<ClientTokenPurpose, string> = { ACTIVATE: '/hesabim/etkinlestir', RESET: '/hesabim/sifre-sifirla' };

/**
 * Yeni bir bağlantı üretir. Aynı amaçla verilmiş, kullanılmamış eski bağlantılar geçersiz kılınır
 * (bir bağlantı yeniden üretildiyse öncekinin işe yaramaması beklenir).
 */
export async function issueAccountLink(accountId: string, purpose: ClientTokenPurpose): Promise<{ link: string; expiresAt: Date }> {
  const token = randomToken(32);
  const ttlMs = purpose === 'ACTIVATE' ? ACTIVATION_TTL_HOURS * 36e5 : RESET_TTL_MINUTES * 60_000;
  const expiresAt = new Date(Date.now() + ttlMs);
  await prisma.$transaction([
    prisma.clientAccountToken.updateMany({ where: { accountId, purpose, usedAt: null }, data: { usedAt: new Date() } }),
    prisma.clientAccountToken.create({ data: { tokenHash: sha256(token), accountId, purpose, expiresAt } }),
  ]);
  return { link: `${env.publicSiteUrl}${PATH[purpose]}?token=${token}`, expiresAt };
}

/** Bağlantıyı e-postayla da gönderir (SMTP yapılandırılmışsa). Gönderemezse false döner — panel bağlantıyı yine de gösterir. */
export async function emailAccountLink(to: string, firstName: string, purpose: ClientTokenPurpose, link: string) {
  if (!isEmailConfigured()) return false;
  const activate = purpose === 'ACTIVATE';
  try {
    await sendMail({
      to,
      subject: activate ? 'Danışan hesabınız hazır — Nida Akın' : 'Şifre sıfırlama — Nida Akın',
      text: activate
        ? `Merhaba ${firstName},\n\nBeslenme listelerinizi, tariflerinizi ve randevularınızı görebileceğiniz danışan hesabınız açıldı. Şifrenizi belirlemek için aşağıdaki bağlantıyı ${ACTIVATION_TTL_HOURS / 24} gün içinde kullanın:\n${link}\n\nDyt. Nida Akın`
        : `Merhaba ${firstName},\n\nŞifrenizi sıfırlamak için aşağıdaki bağlantıyı ${RESET_TTL_MINUTES} dakika içinde kullanın:\n${link}\n\nBu isteği siz yapmadıysanız bu e-postayı yok sayabilirsiniz.`,
    });
    return true;
  } catch (e) {
    console.error('Danışan bağlantı e-postası gönderilemedi', e);
    return false;
  }
}

export async function accountInfo(a: ClientAccount): Promise<PortalAccountInfo> {
  const pending = a.passwordHash
    ? null
    : await prisma.clientAccountToken.findFirst({
        where: { accountId: a.id, purpose: 'ACTIVATE', usedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { expiresAt: 'desc' },
        select: { expiresAt: true },
      });
  return {
    id: a.id,
    email: a.email,
    isActive: a.isActive,
    activated: !!a.passwordHash,
    activatedAt: a.activatedAt?.toISOString() ?? null,
    lastLoginAt: a.lastLoginAt?.toISOString() ?? null,
    createdAt: a.createdAt.toISOString(),
    pendingActivationUntil: pending?.expiresAt.toISOString() ?? null,
  };
}

/** Panelden bağlantı üretme: etkinleştirilmemiş hesapta etkinleştirme, etkin hesapta şifre sıfırlama bağlantısı */
export async function staffLinkFor(a: ClientAccount, firstName: string): Promise<PortalLinkResult> {
  const purpose: ClientTokenPurpose = a.passwordHash ? 'RESET' : 'ACTIVATE';
  const { link, expiresAt } = await issueAccountLink(a.id, purpose);
  const emailed = await emailAccountLink(a.email, firstName, purpose, link);
  return { link, expiresAt: expiresAt.toISOString(), purpose, emailed };
}
