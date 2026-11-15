// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * WhatsApp Business Cloud API (isteğe bağlı, otomatik gönderim).
 * Yalnızca panelde etkinleştirilip telefon numarası kimliği ve erişim anahtarı girildiyse çalışır.
 * Şablon (template) mesajı gönderir; hiçbir hata istek akışına fırlatılmaz, yalnızca günlüğe/denetim kaydına yazılır.
 * Erişim anahtarı hiçbir zaman günlüğe, hata iletisine ya da yanıta girmez.
 */
import { prisma } from '../lib/db';
import { audit } from '../lib/audit';
import { formatDate, formatTime } from '../../shared/time';
import { toWhatsappNumber, WHATSAPP_TEMPLATE_PARAMS } from '../../shared/integrations';
import { getWhatsappSecret, type WhatsappSecret } from './integrations';

export type WhatsappEvent = keyof typeof WHATSAPP_TEMPLATE_PARAMS;
type Result = { ok: true } | { ok: false; message: string };

const TIMEOUT_MS = 8_000;

/** WhatsApp şablon parametreleri satır sonu/sekme içeremez ve boş olamaz */
function clean(v: string) {
  return (v.replace(/[\r\n\t]+/g, ' ').replace(/ {2,}/g, ' ').trim() || '-').slice(0, 1000);
}

/** Meta hata kodlarını kullanıcıya anlaşılır Türkçe iletilere çevirir (token içermez) */
function describeGraphError(status: number, body: unknown): string {
  const e = (body as { error?: { code?: number; error_subcode?: number; message?: string } } | null)?.error;
  const code = e?.code;
  if (code === 190 || status === 401) return 'Erişim anahtarı geçersiz veya süresi dolmuş. Kalıcı bir erişim anahtarı oluşturup yeniden girin.';
  if (code === 131030) return 'Alıcı numarası izinli listede değil. Test aşamasındaki hesaplarda numarayı Meta panelinde alıcı olarak ekleyin.';
  if (code === 132001) return 'Şablon bulunamadı. Şablon adını ve şablon dilini Meta panelindekiyle aynı yazdığınızdan emin olun.';
  if (code === 132000) return 'Şablondaki değişken sayısı gönderilenle uyuşmuyor. Şablonun gövde parametre sırasını kontrol edin.';
  if (code === 132012) return 'Şablon parametre biçimi kabul edilmedi. Şablonu kontrol edin.';
  if (code === 132015 || code === 132016) return 'Şablon Meta tarafından onaylanmamış veya duraklatılmış.';
  if (code === 100) return 'Telefon numarası kimliği veya istek bilgileri geçersiz. Telefon numarası kimliğini kontrol edin.';
  if (code === 10 || code === 200 || (code && code >= 200 && code < 300)) return 'Erişim anahtarının bu telefon numarasına mesaj gönderme izni yok.';
  if (code === 130429 || code === 80007 || status === 429) return 'Gönderim sınırına ulaşıldı. Biraz sonra tekrar deneyin.';
  return `WhatsApp isteği reddedildi (HTTP ${status}${code ? `, kod ${code}` : ''}).`;
}

async function post(cfg: WhatsappSecret, to: string, templateName: string, params: string[]): Promise<Result> {
  const url = `https://graph.facebook.com/${encodeURIComponent(cfg.apiVersion)}/${encodeURIComponent(cfg.phoneNumberId)}/messages`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: templateName,
          language: { code: cfg.templateLanguage },
          components: [{ type: 'body', parameters: params.map((p) => ({ type: 'text', text: clean(p) })) }],
        },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.ok) return { ok: true };
    return { ok: false, message: describeGraphError(res.status, await res.json().catch(() => null)) };
  } catch (e) {
    const timeout = (e as Error)?.name === 'TimeoutError' || (e as Error)?.name === 'AbortError';
    return { ok: false, message: timeout ? 'WhatsApp sunucusundan yanıt alınamadı (zaman aşımı).' : 'WhatsApp sunucusuna ulaşılamadı. İnternet bağlantısını kontrol edin.' };
  }
}

/** Etkin ve yapılandırılmışsa true */
export async function isWhatsappCloudConfigured() {
  return (await getWhatsappSecret()) !== null;
}

/** Olay için şablonlu mesaj gönderir. Asla fırlatmaz; başarısızlık günlüğe ve denetim kaydına yazılır. */
export async function sendWhatsappEvent(event: WhatsappEvent, to: string | null | undefined, params: string[], ref?: { appointmentId?: string }): Promise<Result | null> {
  try {
    const cfg = await getWhatsappSecret();
    if (!cfg) return null;
    const template = cfg.templates[event];
    const number = toWhatsappNumber(to);
    if (!template || !number) return null; // şablon adı ya da alıcı yoksa gönderim yapılmaz
    const r = await post(cfg, number, template, params);
    if (!r.ok) {
      console.warn(`WhatsApp gönderilemedi (${event}): ${r.message}`);
      await audit(null, 'whatsapp.send_failed', 'appointment', ref?.appointmentId ?? null, { event, error: r.message });
    }
    return r;
  } catch (e) {
    console.warn(`WhatsApp gönderimi hata verdi (${event})`, (e as Error).message);
    return null;
  }
}

/** Personele yeni talep bildirimi (talep başlığı, özet, referans) */
export function whatsappNotifyStaffRequest(data: { title: string; body?: string | null; appointmentId?: string | null }) {
  return getWhatsappSecret().then((cfg) => {
    if (!cfg?.staffNumber) return null;
    const reference = data.appointmentId ? data.appointmentId.slice(-6).toUpperCase() : '-';
    return sendWhatsappEvent('requestStaff', cfg.staffNumber, [data.title, data.body ?? '-', reference], { appointmentId: data.appointmentId ?? undefined });
  });
}

/** Danışana randevu onayı / hatırlatma: ad, tarih, saat (+ onayda referans) */
export async function whatsappNotifyClient(event: 'confirmedClient' | 'reminderClient', appointmentId: string) {
  try {
    const a = await prisma.appointment.findUnique({ where: { id: appointmentId }, select: { id: true, contactName: true, contactPhone: true, startsAt: true } });
    if (!a?.startsAt) return null;
    const date = formatDate(a.startsAt);
    const time = formatTime(a.startsAt);
    const ref = a.id.slice(-6).toUpperCase();
    const first = a.contactName.trim().split(/\s+/)[0] || a.contactName;
    const params = event === 'confirmedClient' ? [first, date, time, ref] : [first, date, time];
    return await sendWhatsappEvent(event, a.contactPhone, params, { appointmentId: a.id });
  } catch (e) {
    console.warn(`WhatsApp danışan bildirimi hazırlanamadı (${event})`, (e as Error).message);
    return null;
  }
}

/** Panelden "Test mesajı gönder": personel numarasına, "yeni talep" şablonuyla örnek bir mesaj */
export async function sendWhatsappTest(): Promise<Result> {
  const cfg = await getWhatsappSecret({ requireEnabled: false });
  if (!cfg) return { ok: false, message: 'Önce telefon numarası kimliğini ve erişim anahtarını kaydedin.' };
  const to = toWhatsappNumber(cfg.staffNumber);
  if (!to) return { ok: false, message: 'Personel bildirim numarasını girip kaydedin.' };
  if (!cfg.templates.requestStaff) return { ok: false, message: 'Test için “Yeni talep (personel)” şablon adını girip kaydedin.' };
  return post(cfg, to, cfg.templates.requestStaff, ['Test mesajı', 'Bu bir deneme bildirimidir', 'TEST01']);
}
