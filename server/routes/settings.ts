// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Kullanıcı profili, bildirim tercihleri, oturumlar ve kullanıcı yönetimi */
import { z } from 'zod';
import { prisma } from '../lib/db';
import { badRequest, body, HttpError, notFound, param, parse, router } from '../lib/http';
import { audit } from '../lib/audit';
import { hashPassword, randomToken, sha256, verifyPassword } from '../lib/crypto';
import { env } from '../lib/env';
import { authUser, requirePermission } from '../auth/session';
import { notificationPrefsSchema, profileSchema } from '../../shared/schemas';
import { channelStatus } from '../services/notifications';
import { isEmailConfigured, sendMail } from '../services/mailer';
import { getSmtpView, getWhatsappView, saveSmtp, saveWhatsapp } from '../services/integrations';
import { sendWhatsappTest } from '../services/whatsapp';
import { getSetting } from '../services/settings';
import { smtpInputSchema, whatsappCloudInputSchema } from '../../shared/integrations';
import { emailSchema } from '../../shared/schemas';
import { ROLE_LABEL } from '../../shared/constants';

export const settingsRouter = router();

const profileSelect = { id: true, email: true, firstName: true, lastName: true, salutation: true, lastLoginAt: true, role: { select: { key: true, name: true } } } as const;

settingsRouter.get('/profile', async (c) => {
  return c.json({ profile: await prisma.user.findUniqueOrThrow({ where: { id: authUser(c).id }, select: profileSelect }) });
});

settingsRouter.patch('/profile', async (c) => {
  const data = parse(profileSchema.extend({ currentPassword: z.string().max(200).optional() }), await body(c));
  const user = await prisma.user.findUniqueOrThrow({ where: { id: authUser(c).id } });
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
  await audit(c, 'user.profile_updated', 'user', user.id, { emailChanged: profile.email !== user.email || undefined });
  return c.json({ profile: updated });
});

settingsRouter.get('/notification-prefs', async (c) => {
  const u = await prisma.user.findUniqueOrThrow({ where: { id: authUser(c).id }, select: { notificationPrefs: true } });
  const prefs = (u.notificationPrefs ?? {}) as { inApp?: Record<string, boolean>; email?: Record<string, boolean> };
  return c.json({ prefs: { inApp: prefs.inApp ?? {}, email: prefs.email ?? {} }, channels: await channelStatus() });
});

settingsRouter.patch('/notification-prefs', async (c) => {
  const prefs = parse(notificationPrefsSchema, await body(c));
  await prisma.user.update({ where: { id: authUser(c).id }, data: { notificationPrefs: prefs } });
  await audit(c, 'user.notification_prefs_updated', 'user', authUser(c).id);
  return c.json({ prefs });
});

settingsRouter.get('/channels', async (c) => {
  return c.json({ channels: await channelStatus() });
});

// ───────────── E-posta (SMTP) ve WhatsApp ayarları ─────────────
// Gizli değerler (SMTP şifresi, WhatsApp erişim anahtarı) şifreli saklanır ve hiçbir yanıtta dönmez.

/** Hazır WhatsApp mesajları: randevu ekranındaki "WhatsApp'tan yaz" için tüm panel kullanıcılarına açık (gizli değer içermez) */
settingsRouter.get('/whatsapp-templates', async (c) => {
  return c.json({ templates: await getSetting('whatsappTemplates') });
});

settingsRouter.get('/smtp', requirePermission('settings:write'), async (c) => {
  return c.json({ smtp: await getSmtpView(), envFallback: Boolean(env.SMTP_HOST && env.MAIL_FROM) });
});

settingsRouter.put('/smtp', requirePermission('settings:write'), async (c) => {
  const input = parse(smtpInputSchema, await body(c));
  const before = await getSmtpView();
  const smtp = await saveSmtp(input, authUser(c).id);
  await audit(c, 'settings.smtp_updated', 'website_setting', 'smtp', { host: smtp.host, port: smtp.port, secure: smtp.secure, passwordChanged: Boolean(input.password) || before.hasPassword !== smtp.hasPassword });
  return c.json({ smtp });
});

settingsRouter.post('/smtp/test', requirePermission('settings:write'), async (c) => {
  const me = await prisma.user.findUniqueOrThrow({ where: { id: authUser(c).id }, select: { email: true } });
  const r = await sendMail({
    to: me.email,
    subject: 'Test e-postası — Nida Akın Panel',
    text: 'Bu bir deneme iletisidir. Bu e-postayı aldıysanız SMTP ayarlarınız doğru çalışıyor demektir.',
  });
  if (r.sent) {
    await audit(c, 'settings.smtp_test', 'website_setting', 'smtp', { ok: true });
    return c.json({ ok: true, to: me.email });
  }
  if (r.reason === 'NOT_CONFIGURED') {
    throw new HttpError(409, 'EMAIL_NOT_CONFIGURED', 'E-posta ayarları eksik. Sunucu adresi ve gönderen e-postasını girip kaydedin.');
  }
  await audit(c, 'settings.smtp_test', 'website_setting', 'smtp', { ok: false, error: r.error });
  throw new HttpError(502, 'EMAIL_SEND_FAILED', `Test e-postası gönderilemedi. ${r.message}`);
});

settingsRouter.get('/whatsapp', requirePermission('settings:write'), async (c) => {
  return c.json({ whatsapp: await getWhatsappView() });
});

settingsRouter.put('/whatsapp', requirePermission('settings:write'), async (c) => {
  const input = parse(whatsappCloudInputSchema, await body(c));
  const before = await getWhatsappView();
  if (input.enabled && (!input.phoneNumberId || (!input.accessToken && !before.hasToken))) {
    throw new HttpError(422, 'VALIDATION_ERROR', 'Etkinleştirmek için telefon numarası kimliği ve erişim anahtarı gerekli', {
      fields: {
        ...(!input.phoneNumberId ? { phoneNumberId: 'Telefon numarası kimliği gerekli' } : {}),
        ...(!input.accessToken && !before.hasToken ? { accessToken: 'Erişim anahtarı gerekli' } : {}),
      },
    });
  }
  const whatsapp = await saveWhatsapp(input, authUser(c).id);
  await audit(c, 'settings.whatsapp_updated', 'website_setting', 'whatsapp', { enabled: whatsapp.enabled, apiVersion: whatsapp.apiVersion, tokenChanged: Boolean(input.accessToken) });
  return c.json({ whatsapp });
});

settingsRouter.post('/whatsapp/test', requirePermission('settings:write'), async (c) => {
  const r = await sendWhatsappTest();
  await audit(c, 'settings.whatsapp_test', 'website_setting', 'whatsapp', r.ok ? { ok: true } : { ok: false, error: r.message });
  if (!r.ok) throw new HttpError(502, 'WHATSAPP_SEND_FAILED', `Test mesajı gönderilemedi. ${r.message}`);
  return c.json({ ok: true });
});

settingsRouter.get('/sessions', async (c) => {
  const sessions = await prisma.session.findMany({
    where: { userId: authUser(c).id, expiresAt: { gt: new Date() } },
    orderBy: { lastSeenAt: 'desc' },
    select: { id: true, createdAt: true, lastSeenAt: true, ip: true, userAgent: true, remember: true, expiresAt: true },
  });
  return c.json({ sessions: sessions.map((s) => ({ ...s, current: s.id === authUser(c).sessionId })) });
});

settingsRouter.delete('/sessions/:id', async (c) => {
  if (param(c) === authUser(c).sessionId) throw badRequest('Mevcut oturumu kapatmak için "Oturumu kapat" seçeneğini kullanın.');
  const r = await prisma.session.deleteMany({ where: { id: param(c), userId: authUser(c).id } });
  if (!r.count) throw notFound('Oturum bulunamadı');
  await audit(c, 'auth.session_revoked', 'session', param(c));
  return c.json({ ok: true });
});

settingsRouter.get('/users', requirePermission('users:manage'), async (c) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'asc' },
    select: { id: true, email: true, firstName: true, lastName: true, isActive: true, lastLoginAt: true, createdAt: true, role: { select: { key: true, name: true } } },
  });
  return c.json({ users });
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
  if (await isEmailConfigured()) {
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

settingsRouter.post('/users', requirePermission('users:manage'), async (c) => {
  const input = parse(userCreateSchema, await body(c));
  if (await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } })) {
    throw new HttpError(409, 'EMAIL_TAKEN', 'Bu e-posta ile bir kullanıcı zaten var', { fields: { email: 'Bu e-posta ile bir kullanıcı zaten var' } });
  }
  const role = await prisma.role.findUnique({ where: { key: input.role } });
  if (!role) throw notFound('Rol bulunamadı');
  // Kullanılamaz rastgele şifre: kullanıcı bağlantıyla kendi şifresini belirleyene kadar giriş yapılamaz
  const user = await prisma.user.create({
    data: { email: input.email, firstName: input.firstName, lastName: input.lastName, roleId: role.id, passwordHash: await hashPassword(randomToken(32)) },
    select: { id: true, email: true, firstName: true, lastName: true, isActive: true, lastLoginAt: true, createdAt: true, role: { select: { key: true, name: true } } },
  });
  const link = await issueSetPasswordLink(user, true);
  await audit(c, 'user.created', 'user', user.id, { role: input.role, roleLabel: ROLE_LABEL[input.role], emailed: link.emailed });
  return c.json({ user, link }, 201);
});

/** Şifre belirleme bağlantısını yeniden üretir (bağlantı kaybolduysa ya da kullanıcı şifresini unuttuysa) */
settingsRouter.post('/users/:id/link', requirePermission('users:manage'), async (c) => {
  const user = await prisma.user.findUnique({ where: { id: param(c) } });
  if (!user) throw notFound('Kullanıcı bulunamadı');
  if (!user.isActive) throw new HttpError(409, 'USER_INACTIVE', 'Kullanıcı devre dışı. Önce etkinleştirin.');
  const link = await issueSetPasswordLink(user, false);
  await audit(c, 'user.link_issued', 'user', user.id, { emailed: link.emailed });
  return c.json({ link });
});

settingsRouter.patch('/users/:id', requirePermission('users:manage'), async (c) => {
  const { isActive } = parse(z.object({ isActive: z.boolean() }), await body(c));
  if (param(c) === authUser(c).id) throw badRequest('Kendi hesabınızı devre dışı bırakamazsınız.');
  const user = await prisma.user.findUnique({ where: { id: param(c) } });
  if (!user) throw notFound('Kullanıcı bulunamadı');
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { isActive } }),
    ...(isActive ? [] : [prisma.session.deleteMany({ where: { userId: user.id } })]),
  ]);
  await audit(c, isActive ? 'user.activated' : 'user.deactivated', 'user', user.id);
  return c.json({ ok: true });
});
