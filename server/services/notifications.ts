// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Bildirim servisi
 *  - Panel içi bildirim her zaman oluşturulur (kullanıcı tercihi kapatmadıysa).
 *  - Harici kanallar (e-posta, WhatsApp) için "channel adapter" mimarisi:
 *    kanal yapılandırılmamışsa gönderim YAPILMAZ ve NotificationDelivery'ye SKIPPED_NOT_CONFIGURED yazılır.
 *  - WhatsApp: panelden etkinleştirilen Cloud API (bkz. whatsapp.ts). Şablonlu mesajlar olay bazında
 *    gönderilir (yeni talep -> personel, onay/hatırlatma -> danışan); bu adaptör yalnızca durum bildirir.
 */
import { prisma, type Tx } from '../lib/db';
import type { NotificationType } from '../../shared/constants';
import { env } from '../lib/env';
import { isEmailConfigured, sendMail } from './mailer';
import { isWhatsappCloudConfigured, whatsappNotifyClient, whatsappNotifyStaffRequest } from './whatsapp';

interface ChannelResult {
  status: 'SENT' | 'FAILED' | 'SKIPPED_NOT_CONFIGURED';
  error?: string;
}
interface Channel {
  key: 'EMAIL' | 'WHATSAPP';
  isConfigured(): boolean | Promise<boolean>;
  send(to: { email: string }, n: { title: string; body?: string | null; link?: string }): Promise<ChannelResult>;
}

const emailChannel: Channel = {
  key: 'EMAIL',
  isConfigured: isEmailConfigured,
  async send(to, n) {
    const r = await sendMail({
      to: to.email,
      subject: n.title,
      text: `${n.title}\n\n${n.body ?? ''}${n.link ? `\n\nPanelde görüntüle: ${n.link}` : ''}`,
    });
    if (r.sent) return { status: 'SENT' };
    return r.reason === 'NOT_CONFIGURED' ? { status: 'SKIPPED_NOT_CONFIGURED' } : { status: 'FAILED', error: r.error };
  },
};

const whatsappChannel: Channel = {
  key: 'WHATSAPP',
  isConfigured: isWhatsappCloudConfigured,
  async send() {
    return { status: 'SKIPPED_NOT_CONFIGURED' };
  },
};

export const channels = [emailChannel, whatsappChannel];

export async function channelStatus() {
  return Promise.all(channels.map(async (c) => ({ key: c.key, configured: await c.isConfigured() })));
}

interface Prefs {
  inApp?: Record<string, boolean>;
  email?: Record<string, boolean>;
}

export async function notifyStaff(
  type: NotificationType,
  data: { title: string; body?: string | null; appointmentId?: string | null; clientId?: string | null },
  tx?: Tx,
) {
  const db = tx ?? prisma;
  const users = await db.user.findMany({ where: { isActive: true }, select: { id: true, email: true, notificationPrefs: true } });
  const created: { id: string; userId: string; email: string; prefs: Prefs }[] = [];
  for (const u of users) {
    const prefs = (u.notificationPrefs ?? {}) as Prefs;
    if (prefs.inApp?.[type] === false) continue;
    const n = await db.notification.create({
      data: { userId: u.id, type, title: data.title, body: data.body ?? null, appointmentId: data.appointmentId ?? null, clientId: data.clientId ?? null },
    });
    created.push({ id: n.id, userId: u.id, email: u.email, prefs });
  }
  // Harici kanallar transaction dışında, arka planda
  const link = data.appointmentId ? `${env.publicSiteUrl}/panel/randevular?id=${data.appointmentId}` : `${env.publicSiteUrl}/panel/bildirimler`;
  if (type === 'APPOINTMENT_REQUESTED') void whatsappNotifyStaffRequest(data).catch(() => {});
  setImmediate(() => {
    void (async () => {
      for (const c of created) {
        if (c.prefs.email?.[type] !== true) continue; // e-posta yalnızca açıkça istenirse
        const res = (await emailChannel.isConfigured())
          ? await emailChannel.send({ email: c.email }, { ...data, link })
          : { status: 'SKIPPED_NOT_CONFIGURED' as const };
        await prisma.notificationDelivery
          .create({ data: { notificationId: c.id, channel: 'EMAIL', status: res.status, error: 'error' in res ? res.error : null } })
          .catch(() => {});
      }
    })();
  });
}

/**
 * Yaklaşan randevu hatırlatıcısı: önümüzdeki 24 saat içindeki onaylı randevular için bir kez bildirim üretir.
 * server/index.ts içinde periyodik olarak çalıştırılır.
 */
export async function generateUpcomingReminders() {
  const now = new Date();
  const horizon = new Date(now.getTime() + 24 * 36e5);
  const due = await prisma.appointment.findMany({
    where: { status: 'CONFIRMED', reminderNotifiedAt: null, startsAt: { gte: now, lte: horizon } },
    select: { id: true, contactName: true, startsAt: true, clientId: true },
  });
  const { formatDateTime } = await import('../../shared/time');
  for (const a of due) {
    await notifyStaff('APPOINTMENT_UPCOMING', {
      title: `Yaklaşan randevu: ${a.contactName}`,
      body: `${formatDateTime(a.startsAt!)}`,
      appointmentId: a.id,
      clientId: a.clientId,
    });
    await prisma.appointment.update({ where: { id: a.id }, data: { reminderNotifiedAt: new Date() } });
    void whatsappNotifyClient('reminderClient', a.id);
  }
}
