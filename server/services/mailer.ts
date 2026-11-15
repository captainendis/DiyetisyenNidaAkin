// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * E-posta kanalı. SMTP ayarları yoksa hiçbir şey gönderilmez ve çağıran taraf bunu bilir
 * (gönderiyormuş gibi davranılmaz).
 *
 * Ayar önceliği: panelden girilen (Ayarlar → E-posta & WhatsApp) değerler önce gelir; sunucu adresi
 * panelde boşsa ortam değişkenlerine (SMTP_*, MAIL_FROM) geri dönülür. Gönderen e-postası panelde boşsa
 * MAIL_FROM kullanılır.
 */
import nodemailer from 'nodemailer';
import { env } from '../lib/env';
import { getSmtpSecret } from './integrations';

interface ResolvedSmtp {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string | { name: string; address: string };
}

async function resolveSmtp(): Promise<ResolvedSmtp | null> {
  const db = await getSmtpSecret().catch(() => null);
  if (db?.host) {
    const from = db.fromEmail ? (db.fromName ? { name: db.fromName, address: db.fromEmail } : db.fromEmail) : env.MAIL_FROM;
    if (!from) return null;
    return { host: db.host, port: db.port, secure: db.secure, user: db.username, pass: db.password, from };
  }
  if (env.SMTP_HOST && env.MAIL_FROM) {
    return { host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_SECURE, user: env.SMTP_USER, pass: env.SMTP_PASS, from: env.MAIL_FROM };
  }
  return null;
}

export async function isEmailConfigured() {
  return (await resolveSmtp()) !== null;
}

export type MailFailure = { sent: false; reason: 'NOT_CONFIGURED' } | { sent: false; reason: 'FAILED'; error: string; message: string };

/** Hata iletisinden olası sır sızıntısını temizler ve kullanıcıya gösterilecek Türkçe açıklamayı üretir */
function explain(e: unknown, secrets: string[]): { error: string; message: string } {
  const err = e as { code?: string; responseCode?: number; message?: string };
  let raw = String(err?.message ?? 'Bilinmeyen hata');
  for (const s of secrets) if (s) raw = raw.split(s).join('***');
  raw = raw.slice(0, 300);
  let message: string;
  if (err?.code === 'EAUTH' || err?.responseCode === 535) message = 'Kullanıcı adı veya şifre sunucu tarafından kabul edilmedi.';
  else if (err?.code === 'ENOTFOUND' || err?.code === 'EDNS') message = 'Sunucu adresi bulunamadı. Adresi kontrol edin.';
  else if (err?.code === 'ECONNREFUSED') message = 'Sunucuya bağlanılamadı. Adres ve portu kontrol edin.';
  else if (err?.code === 'ETIMEDOUT' || (err?.code === 'ESOCKET' && /timeout/i.test(raw))) message = 'Sunucudan yanıt alınamadı (zaman aşımı). Adres, port ve güvenlik seçeneğini kontrol edin.';
  else if (err?.code === 'ESOCKET' || /ssl|tls|wrong version/i.test(raw)) message = 'Güvenli bağlantı kurulamadı. 465 portunda “TLS” açık, 587 portunda kapalı olmalıdır.';
  else if (err?.code === 'EENVELOPE') message = 'Gönderen veya alıcı adresi geçersiz görünüyor.';
  else message = 'E-posta gönderilemedi. Ayarları kontrol edip tekrar deneyin.';
  return { error: raw, message };
}

export async function sendMail(opts: { to: string; subject: string; text: string; html?: string }): Promise<{ sent: true } | MailFailure> {
  const cfg = await resolveSmtp();
  if (!cfg) return { sent: false, reason: 'NOT_CONFIGURED' };
  try {
    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
    await transporter.sendMail({ from: cfg.from, ...opts });
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: 'FAILED', ...explain(e, [cfg.pass]) };
  }
}
