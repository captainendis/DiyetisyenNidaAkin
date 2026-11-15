// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Hazır WhatsApp mesajları (tıkla-yaz). zod içermez; varsayılanlar ve panel paylaşır. */

export interface WhatsappTemplates {
  requestReceived: string;
  appointmentConfirmed: string;
  reminder: string;
  pilatesInfo: string;
}
export type WhatsappTemplateKey = keyof WhatsappTemplates;

export const WHATSAPP_TEMPLATE_LABEL: Record<WhatsappTemplateKey, string> = {
  requestReceived: 'Talep alındı',
  appointmentConfirmed: 'Randevu onayı',
  reminder: 'Hatırlatma',
  pilatesInfo: 'Pilates ders bilgisi',
};

export const defaultWhatsappTemplates: WhatsappTemplates = {
  requestReceived:
    'Merhaba {ad}, randevu talebiniz bize ulaştı (referans: {referans}). Uygunluğu kontrol edip en kısa sürede size dönüş yapacağız.',
  appointmentConfirmed:
    'Merhaba {ad}, randevunuz {tarih} saat {saat} için onaylanmıştır (referans: {referans}). Görüşmek üzere.',
  reminder: 'Merhaba {ad}, {tarih} saat {saat} tarihindeki randevunuzu hatırlatmak isteriz. Gelemeyecekseniz lütfen önceden haber verin.',
  pilatesInfo:
    'Merhaba {ad}, pilates dersiniz {tarih} saat {saat} için planlanmıştır (referans: {referans}). Rahat kıyafetlerle gelmenizi rica ederiz.',
};

export const WHATSAPP_PLACEHOLDERS = ['{ad}', '{tarih}', '{saat}', '{referans}'] as const;

export function fillTemplate(text: string, v: { ad: string; tarih: string; saat: string; referans: string }) {
  return text.replace(/\{(ad|tarih|saat|referans)\}/g, (_, k: keyof typeof v) => v[k]);
}

/**
 * Telefonu wa.me / Cloud API için yalnızca rakam, ülke koduyla biçime çevirir.
 * "+905551234567" -> "905551234567"; "05551234567" -> "905551234567"; "5551234567" -> "905551234567".
 * Tanınmayan biçimde null döner.
 */
export function toWhatsappNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let d = phone.replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('0')) d = `90${d.slice(1)}`;
  else if (d.length === 10 && d.startsWith('5')) d = `90${d}`;
  return d.length >= 10 && d.length <= 15 ? d : null;
}
