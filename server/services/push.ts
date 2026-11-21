// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Mobil anlık bildirim (Expo Push Service).
 *  - Cihaz token'ları push_devices tablosunda; sahibi personel kullanıcısı YA DA danışan hesabıdır.
 *  - Gönderim istek akışını asla bozmaz: arka planda (setImmediate) yapılır, hatalar yalnızca loglanır.
 *  - Expo "DeviceNotRegistered" dönerse token silinir (uygulama kaldırıldı / izin kapatıldı).
 *  - EXPO_ACCESS_TOKEN tanımlıysa (Expo hesabında "enhanced push security" açıksa gerekli) Bearer olarak gönderilir.
 *  - İçerik: danışana giden metinde sağlık bilgisi yok (ör. "Randevun onaylandı · 24 Kasım 10:00");
 *    personel bildirimleri panel bildirimleriyle aynı metni taşır (danışan adı dahil).
 *  - data.url: mobil uygulamanın açacağı rota (ör. /panel/randevular/<id>, /hesabim/randevular).
 */
import { prisma } from '../lib/db';
import { env } from '../lib/env';
import type { PushPlatform } from '../../shared/schemas';
import { inTz } from '../../shared/time';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const BATCH = 100;

export interface PushPayload {
  title: string;
  body?: string | null;
  /** Uygulama içi rota — bildirime dokununca açılır */
  url?: string;
  /** Ek veri (data.url ile birlikte gönderilir) */
  data?: Record<string, string | number | boolean | null>;
}

/** Expo mesajı (https://docs.expo.dev/push-notifications/sending-notifications/) */
export interface ExpoMessage {
  to: string;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
  priority?: 'default' | 'normal' | 'high';
  channelId?: string;
}

export type ExpoTicket = { status: 'ok'; id?: string } | { status: 'error'; message?: string; details?: { error?: string } };

/** Gönderici: mesajları (≤100) gönderir, sırayla bilet döner. Testlerde setPushSender ile değiştirilir. */
export type PushSender = (messages: ExpoMessage[]) => Promise<ExpoTicket[]>;

const expoSender: PushSender = async (messages) => {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Accept-Encoding': 'gzip, deflate',
    'Content-Type': 'application/json',
  };
  if (env.EXPO_ACCESS_TOKEN) headers.Authorization = `Bearer ${env.EXPO_ACCESS_TOKEN}`;
  const res = await fetch(EXPO_PUSH_URL, { method: 'POST', headers, body: JSON.stringify(messages), signal: AbortSignal.timeout(15_000) });
  const json = (await res.json().catch(() => null)) as { data?: ExpoTicket[]; errors?: { code?: string; message?: string }[] } | null;
  if (!res.ok || !json?.data) {
    const err = json?.errors?.map((e) => `${e.code ?? ''} ${e.message ?? ''}`.trim()).join('; ');
    throw new Error(`Expo push HTTP ${res.status}${err ? `: ${err}` : ''}`);
  }
  return json.data;
};

/** Testlerde (NODE_ENV=test) gönderici enjekte edilmedikçe ağa çıkılmaz */
let sender: PushSender | null = null;
export function setPushSender(s: PushSender | null) {
  sender = s;
}
function activeSender(): PushSender | null {
  if (sender) return sender;
  return env.NODE_ENV === 'test' ? null : expoSender;
}

const pending = new Set<Promise<void>>();
/** Arka plandaki gönderimlerin bitmesini bekler (testler ve kapanış için) */
export async function flushPush() {
  while (pending.size) await Promise.allSettled([...pending]);
}

function background(fn: () => Promise<void>) {
  const p: Promise<void> = new Promise<void>((resolve) => setImmediate(resolve))
    .then(fn)
    .catch((e) => console.error('[push]', e instanceof Error ? e.message : e))
    .finally(() => pending.delete(p));
  pending.add(p);
}

function toMessages(tokens: string[], p: PushPayload): ExpoMessage[] {
  const data = { ...(p.data ?? {}), ...(p.url ? { url: p.url } : {}) };
  return tokens.map((to) => ({
    to,
    title: p.title.slice(0, 180),
    ...(p.body ? { body: p.body.slice(0, 500) } : {}),
    data,
    sound: 'default',
    priority: 'high',
    channelId: 'default',
  }));
}

/** Token listesine gönderir; DeviceNotRegistered olanları siler. Hata fırlatmaz. */
export async function sendToTokens(tokens: string[], payload: PushPayload) {
  const send = activeSender();
  if (!send || !tokens.length) return;
  const messages = toMessages([...new Set(tokens)], payload);
  const dead: string[] = [];
  for (let i = 0; i < messages.length; i += BATCH) {
    const batch = messages.slice(i, i + BATCH);
    try {
      const tickets = await send(batch);
      tickets.forEach((t, j) => {
        if (t.status !== 'error') return;
        if (t.details?.error === 'DeviceNotRegistered') dead.push(batch[j]!.to);
        else console.warn('[push] gönderilemedi:', t.details?.error ?? t.message);
      });
    } catch (e) {
      console.error('[push] Expo isteği başarısız:', e instanceof Error ? e.message : e);
    }
  }
  if (dead.length) await prisma.pushDevice.deleteMany({ where: { token: { in: dead } } });
}

/** Personel kullanıcılarına (arka planda) */
export function pushToUsers(userIds: string[], payload: PushPayload) {
  if (!userIds.length) return;
  background(async () => {
    const rows = await prisma.pushDevice.findMany({ where: { userId: { in: userIds }, user: { isActive: true, role: { key: { not: 'REVIEWER' } } } }, select: { token: true } });
    await sendToTokens(rows.map((r) => r.token), payload);
  });
}

/** Danışanın (etkin) hesabına kayıtlı cihazlara (arka planda). Hesap yoksa sessizce geçer. */
export function pushToClient(clientId: string | null | undefined, payload: PushPayload) {
  if (!clientId) return;
  background(async () => {
    const rows = await prisma.pushDevice.findMany({
      where: { clientAccount: { clientId, isActive: true, client: { status: { not: 'ARCHIVED' } } } },
      select: { token: true },
    });
    await sendToTokens(rows.map((r) => r.token), payload);
  });
}

// ───────────────────────── Cihaz kaydı ─────────────────────────

/** Sahip + kaydı yapan oturum (oturum silinince kayıt da silinir — şema: onDelete Cascade) */
export type PushOwner = { userId: string; sessionId?: string } | { clientAccountId: string; clientSessionId?: string };
const ownerWhere = (o: PushOwner) => ('userId' in o ? { userId: o.userId } : { clientAccountId: o.clientAccountId });

/** Token'ı kaydeder; başka hesaba kayıtlıysa sahiplik bu hesaba geçer (tam olarak bir sahip). */
export async function registerDevice(owner: PushOwner, token: string, platform: PushPlatform) {
  const ownerData =
    'userId' in owner
      ? { userId: owner.userId, clientAccountId: null, sessionId: owner.sessionId ?? null, clientSessionId: null }
      : { userId: null, clientAccountId: owner.clientAccountId, sessionId: null, clientSessionId: owner.clientSessionId ?? null };
  const now = new Date();
  await prisma.pushDevice.upsert({
    where: { token },
    create: { token, platform, ...ownerData, lastSeenAt: now },
    update: { platform, ...ownerData, lastSeenAt: now },
  });
}

/** Yalnızca bu sahibin token'ını siler (başkasının token'ı silinemez; yanıt yine de başarılıdır) */
export async function unregisterDevice(owner: PushOwner, token: string) {
  const r = await prisma.pushDevice.deleteMany({ where: { token, ...ownerWhere(owner) } });
  return r.count;
}

// ───────────────────────── Biçim yardımcıları ─────────────────────────

/** Danışan bildirimleri için kısa tarih: "24 Kasım 10:00" */
export function shortWhen(d: Date | null | undefined) {
  return d ? inTz(d).toFormat('d MMMM HH:mm') : '';
}
