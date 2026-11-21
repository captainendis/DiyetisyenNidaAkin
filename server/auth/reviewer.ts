// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Mağaza incelemesi rolü (REVIEWER). Google Play / App Store incelemecisi personel panelini görebilsin diye vardır;
 * gerçek danışanların hiçbir verisine erişmemelidir. İki katman:
 *
 *  1. reviewerGuard (bu dosya, tüm personel uçlarında requireAuth'tan sonra):
 *     - Yalnızca okuma: GET/HEAD dışındaki her istek reddedilir (cihaz kaydı hariç).
 *     - Yalnızca izin listesindeki yollar: listede olmayan her uç 403 (yeni bir uç eklendiğinde kapalı başlar).
 *     - Tekil kayıtlar (/clients/:id/…, /appointments/:id, /plans/:id, /recipes/:id) yalnızca demo danışana
 *       aitse açılır; değilse 404 (kaydın varlığı da sızdırılmaz).
 *  2. Liste ve sayım uçları: sorgular reviewerScope ile isDemo danışanlarla sınırlanır (clients, appointments,
 *     dashboard, plans, recipes).
 *
 * Ayrıca bu rol personel bildirimlerini ve anlık bildirimleri almaz (services/notifications.ts, services/push.ts).
 */
import { createMiddleware } from 'hono/factory';
import type { Prisma } from '../generated/prisma/client';
import { prisma } from '../lib/db';
import { forbidden, notFound, type AppEnv, type Ctx } from '../lib/http';

export const isReviewer = (c: Ctx) => c.var.user?.role === 'REVIEWER';

const ID = '[^/]+';
/** İncelemecinin okuyabileceği yollar (/api sonrası). Kişisel veri içeren her biri ya aşağıda kayıt düzeyinde ya da uçta listede sınırlanır. */
const READ_ALLOW: RegExp[] = [
  /^\/dashboard\/(stats|agenda|weekly|setup)$/,
  /^\/appointments$/,
  /^\/appointments\/(slots|day-plans)$/,
  new RegExp(`^/appointments/${ID}$`),
  /^\/availability\/(rules|blocked-dates)$/,
  /^\/clients$/,
  new RegExp(`^/clients/${ID}(/(appointments|notes|measurements|files|files/${ID}/download|export|messages))?$`),
  /^\/plans$/,
  new RegExp(`^/plans/${ID}(/print)?$`),
  /^\/recipes$/,
  new RegExp(`^/recipes/${ID}$`),
  /^\/notifications(\/(unread-count|channels))?$/,
  /^\/services$/,
  /^\/content\/(settings|categories|posts|faqs|media)$/,
  new RegExp(`^/content/posts/${ID}$`),
  /^\/settings\/(profile|notification-prefs|channels|whatsapp-templates|sessions)$/,
];
/** Okuma dışında izin verilen tek işlem: kendi telefonunun bildirim kaydı */
const WRITE_ALLOW: RegExp[] = [/^\/devices(\/[^/]+)?$/];

const READ_ONLY = 'İnceleme hesabı salt okunurdur; değişiklik yapılamaz.';

/** /api ön ekini atar */
const rel = (c: Ctx) => c.req.path.replace(/^\/api/, '') || '/';

async function assertDemoRecord(path: string) {
  const seg = path.split('/').filter(Boolean);
  const [root, id] = seg;
  if (!id) return;
  const hidden = notFound();
  if (root === 'clients') {
    const row = await prisma.client.findUnique({ where: { id }, select: { isDemo: true } });
    if (!row?.isDemo) throw hidden;
  } else if (root === 'appointments' && id !== 'slots' && id !== 'day-plans') {
    const row = await prisma.appointment.findUnique({ where: { id }, select: { client: { select: { isDemo: true } } } });
    if (!row?.client?.isDemo) throw hidden;
  } else if (root === 'plans') {
    const row = await prisma.nutritionPlan.findUnique({ where: { id }, select: { clientId: true, client: { select: { isDemo: true } } } });
    // Danışana bağlı olmayan şablonlar kişisel veri içermez
    if (!row || (row.clientId && !row.client?.isDemo)) throw hidden;
  } else if (root === 'recipes') {
    const row = await prisma.recipe.findUnique({ where: { id }, select: { clientId: true, client: { select: { isDemo: true } } } });
    // Kütüphane tarifleri (danışansız) açıktır; kişiye özel varyasyon yalnızca demo danışanınki
    if (!row || (row.clientId && !row.client?.isDemo)) throw hidden;
  }
}

export const reviewerGuard = createMiddleware<AppEnv>(async (c, next) => {
  if (!isReviewer(c)) return next();
  const path = rel(c);
  const method = c.req.method;
  if (method !== 'GET' && method !== 'HEAD') {
    if (WRITE_ALLOW.some((r) => r.test(path))) return next();
    throw forbidden(READ_ONLY);
  }
  if (!READ_ALLOW.some((r) => r.test(path))) throw forbidden('Bu bölüm inceleme hesabına kapalıdır.');
  await assertDemoRecord(path);
  return next();
});

/** Liste/sayım sorguları için: incelemecide yalnızca demo danışan kayıtları */
export const clientScope = (c: Ctx): Prisma.ClientWhereInput => (isReviewer(c) ? { isDemo: true } : {});
export const appointmentScope = (c: Ctx): Prisma.AppointmentWhereInput => (isReviewer(c) ? { client: { isDemo: true } } : {});
/** Plan ve tarif: danışansız (şablon / kütüphane) ya da demo danışanınki */
export const ownedByDemoScope = (c: Ctx) => (isReviewer(c) ? { OR: [{ clientId: null }, { client: { isDemo: true } }] } : {});
