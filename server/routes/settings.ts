// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Kullanıcı profili, bildirim tercihleri, oturumlar ve kullanıcı yönetimi */
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/db';
import { badRequest, HttpError, notFound, parse } from '../lib/http';
import { audit } from '../lib/audit';
import { verifyPassword } from '../lib/crypto';
import { requirePermission } from '../auth/session';
import { notificationPrefsSchema, profileSchema } from '../../shared/schemas';
import { channelStatus } from '../services/notifications';

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
