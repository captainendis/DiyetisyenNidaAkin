// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Mobil anlık bildirim cihaz kaydı (Expo push token)
 *  - Personel:  POST /api/devices · DELETE /api/devices/:token (ya da gövdede { token })      — requireAuth + CSRF
 *  - Danışan:   POST /api/portal/devices · DELETE /api/portal/devices/:token (ya da gövdede) — requireClientAuth + CSRF
 * Aynı token başka hesaba kayıtlıysa sahiplik bu hesaba geçer (telefonda hesap değiştirme). Uygulama çıkıştan
 * ÖNCE DELETE çağırır; kayıt oturuma bağlıdır — oturum süresi dolunca ya da şifre değişince de silinir. Expo "DeviceNotRegistered" bildirirse token sunucuda silinir (services/push.ts).
 */
import { z } from 'zod';
import { body, parse, router, type Ctx } from '../lib/http';
import { authUser } from '../auth/session';
import { portalUser } from '../auth/client-session';
import { registerDevice, unregisterDevice, type PushOwner } from '../services/push';
import { pushDeviceSchema, pushTokenSchema } from '../../shared/schemas';

async function tokenFrom(c: Ctx) {
  const fromPath = c.req.param('token');
  const raw = fromPath ?? ((await body(c).catch(() => ({}))) as { token?: unknown }).token;
  return parse(z.object({ token: pushTokenSchema }), { token: raw }).token;
}

function devicesRouter(owner: (c: Ctx) => PushOwner) {
  const r = router();
  r.post('/', async (c) => {
    const { token, platform } = parse(pushDeviceSchema, await body(c));
    await registerDevice(owner(c), token, platform);
    return c.json({ ok: true });
  });
  const remove = async (c: Ctx) => {
    const removed = await unregisterDevice(owner(c), await tokenFrom(c));
    return c.json({ ok: true, removed });
  };
  r.delete('/:token', remove);
  r.delete('/', remove);
  return r;
}

export const staffDevicesRouter = devicesRouter((c) => ({ userId: authUser(c).id, sessionId: authUser(c).sessionId }));
export const portalDevicesRouter = devicesRouter((c) => ({ clientAccountId: portalUser(c).accountId, clientSessionId: portalUser(c).sessionId }));
