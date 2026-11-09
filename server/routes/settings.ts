// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Kullanıcı profili, bildirim tercihleri, oturumlar ve kullanıcı yönetimi */
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/db';
import { badRequest, HttpError, notFound, parse } from '../lib/http';
import { audit } from '../lib/audit';
import { hashPassword, randomToken, sha256, verifyPassword } from '../lib/crypto';
import { env } from '../lib/env';
import { requirePermission } from '../auth/session';
import { notificationPrefsSchema, profileSchema } from '../../shared/schemas';
import { channelStatus } from '../services/notifications';
import { isEmailConfigured, sendMail } from '../services/mailer';
import { emailSchema } from '../../shared/schemas';
import { ROLE_LABEL } from '../../shared/constants';

export const settingsRouter = Router();

const profileSelect = { id: true, email: true, firstName: true, lastName: true, salutation: true, lastLoginAt: true, role: { select: { key: true, name: true } } } as const;

settingsRouter.get('/profile', async (req, res) => {
  res.json({ profile: await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id }, select: profileSelect }) });
});

settingsRouter.patch('/profile', async (req, res) => {
  const data = parse(profileSchema.extend({ currentPassword: z.string().max(200).optional() }), req.body);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
  const { currentPassword, ...profile } = data;
  if (profile.email !== user.email) {
    if (!currentPassword || !(await verifyPassword(currentPassword, user.passwordHash))) {
      throw new HttpError(422, 'VALIDATION_ERROR', 'E-posta değişikliği için mevcut şifrenizi doğrulayın', {
        fields: { currentPassword: 'Mevcut şifre hatalı veya girilmedi' },
      });
    }
    const taken = await prisma.user.findUnique({ where: { email: profile.email } });
    if (taken) throw new HttpError(422, 'VALIDATION_ERROR', 'Bu e-posta kullanılıyor', { fields: { email: 'Bu e-posta başka bir hesapta kayıtlı' } });
  }
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { ...profile, salutation: profile.salutation || null },
    select: profileSelect,
  });
  await audit(req, 'user.profile_updated', 'user', user.id, { emailChanged: profile.email !== user.email || undefined });
  res.json({ profile: updated });
});

settingsRouter.get('/notification-prefs', async (req, res) => {
  const u = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id }, select: { notificationPrefs: true } });
  const prefs = (u.notificationPrefs ?? {}) as { inApp?: Record<string, boolean>; email?: Record<string, boolean> };
  res.json({ prefs: { inApp: prefs.inApp ?? {}, email: prefs.email ?? {} }, channels: channelStatus() });
});

settingsRouter.patch('/notification-prefs', async (req, res) => {
  const prefs = parse(notificationPrefsSchema, req.body);
  await prisma.user.update({ where: { id: req.user!.id }, data: { notificationPrefs: prefs } });
  await audit(req, 'user.notification_prefs_updated', 'user', req.user!.id);
  res.json({ prefs });
});

settingsRouter.get('/channels', (_req, res) => {
  res.json({ channels: channelStatus() });
});

settingsRouter.get('/sessions', async (req, res) => {
  const sessions = await prisma.session.findMany({
    where: { userId: req.user!.id, expiresAt: { gt: new Date() } },
    orderBy: { lastSeenAt: 'desc' },
    select: { id: true, createdAt: true, lastSeenAt: true, ip: true, userAgent: true, remember: true, expiresAt: true },
  });
  res.json({ sessions: sessions.map((s) => ({ ...s, current: s.id === req.user!.sessionId })) });
});

settingsRouter.delete('/sessions/:id', async (req, res) => {
  if (String(req.params.id) === req.user!.sessionId) throw badRequest('Mevcut oturumu kapatmak için "Oturumu kapat" seçeneğini kullanın.');
  const r = await prisma.session.deleteMany({ where: { id: String(req.params.id), userId: req.user!.id } });
  if (!r.count) throw notFound('Oturum bulunamadı');
  await audit(req, 'auth.session_revoked', 'session', String(req.params.id));
  res.json({ ok: true });
});

settingsRouter.get('/users', requirePermission('users:manage'), async (_req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'asc' },
    select: { id: true, email: true, firstName: true, lastName: true, isActive: true, lastLoginAt: true, createdAt: true, role: { select: { key: true, name: true } } },
  });
  res.json({ users });
});

/** Yeni kullanıcının şifre belirleme bağlantısı: kullanıcı ekleyecek kişinin iletmesine zaman tanımak için 72 saat */
const INVITE_TTL_HOURS = 72;

/**
 * Şifre belirleme bağlantısı üretir (mevcut /panel/sifre-sifirla akışı). Kullanılmamış eski bağlantılar geçersiz olur.
 * Şifreyi yönetici hiçbir zaman görmez; kullanıcı kendi belirler.
 */
async function issueSetPasswordLink(user: { id: string; email: string; firstName: string }, isNew: boolean) {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 36e5);
  await prisma.$transaction([
    prisma.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } }),
    prisma.passwordResetToken.create({ data: { tokenHash: sha256(token), userId: user.id, expiresAt } }),
  ]);
  const link = `${env.publicSiteUrl}/panel/sifre-sifirla?token=${token}`;
  let emailed = false;
  if (isEmailConfigured()) {
    try {
      await sendMail({
        to: user.email,
        subject: isNew ? 'Panel hesabınız açıldı — Nida Akın' : 'Panel şifre bağlantısı — Nida Akın',
        text: `Merhaba ${user.firstName},\n\n${isNew ? 'Nida Akın yönetim paneli için hesabınız açıldı.' : 'Panel şifrenizi belirlemek için yeni bir bağlantı oluşturuldu.'} Şifrenizi belirlemek için aşağıdaki bağlantıyı ${INVITE_TTL_HOURS / 24} gün içinde kullanın:\n${link}`,
      });
      emailed = true;
    } catch (e) {
      console.error('Kullanıcı bağlantı e-postası gönderilemedi', e);
    }
  }
  return { link, expiresAt: expiresAt.toISOString(), emailed };
}

const userCreateSchema = z.object({
  email: emailSchema,
  firstName: z.string().trim().min(1, 'Ad gerekli').max(60),
  lastName: z.string().trim().min(1, 'Soyad gerekli').max(60),
  role: z.enum(['ADMIN', 'DIETITIAN', 'ASSISTANT'], { message: 'Rol seçin' }),
});

settingsRouter.post('/users', requirePermission('users:manage'), async (req, res) => {
  const body = parse(userCreateSchema, req.body);
  if (await prisma.user.findUnique({ where: { email: body.email }, select: { id: true } })) {
    throw new HttpError(409, 'EMAIL_TAKEN', 'Bu e-posta ile bir kullanıcı zaten var', { fields: { email: 'Bu e-posta ile bir kullanıcı zaten var' } });
  }
  const role = await prisma.role.findUnique({ where: { key: body.role } });
  if (!role) throw notFound('Rol bulunamadı');
  // Kullanılamaz rastgele şifre: kullanıcı bağlantıyla kendi şifresini belirleyene kadar giriş yapılamaz
  const user = await prisma.user.create({
    data: { email: body.email, firstName: body.firstName, lastName: body.lastName, roleId: role.id, passwordHash: await hashPassword(randomToken(32)) },
    select: { id: true, email: true, firstName: true, lastName: true, isActive: true, lastLoginAt: true, createdAt: true, role: { select: { key: true, name: true } } },
  });
  const link = await issueSetPasswordLink(user, true);
  await audit(req, 'user.created', 'user', user.id, { role: body.role, roleLabel: ROLE_LABEL[body.role], emailed: link.emailed });
  res.status(201).json({ user, link });
});

/** Şifre belirleme bağlantısını yeniden üretir (bağlantı kaybolduysa ya da kullanıcı şifresini unuttuysa) */
settingsRouter.post('/users/:id/link', requirePermission('users:manage'), async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: String(req.params.id) } });
  if (!user) throw notFound('Kullanıcı bulunamadı');
  if (!user.isActive) throw new HttpError(409, 'USER_INACTIVE', 'Kullanıcı devre dışı. Önce etkinleştirin.');
  const link = await issueSetPasswordLink(user, false);
  await audit(req, 'user.link_issued', 'user', user.id, { emailed: link.emailed });
  res.json({ link });
});

settingsRouter.patch('/users/:id', requirePermission('users:manage'), async (req, res) => {
  const { isActive } = parse(z.object({ isActive: z.boolean() }), req.body);
  if (String(req.params.id) === req.user!.id) throw badRequest('Kendi hesabınızı devre dışı bırakamazsınız.');
  const user = await prisma.user.findUnique({ where: { id: String(req.params.id) } });
  if (!user) throw notFound('Kullanıcı bulunamadı');
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { isActive } }),
    ...(isActive ? [] : [prisma.session.deleteMany({ where: { userId: user.id } })]),
  ]);
  await audit(req, isActive ? 'user.activated' : 'user.deactivated', 'user', user.id);
  res.json({ ok: true });
});
