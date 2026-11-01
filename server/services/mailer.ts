// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * E-posta kanalı. SMTP ayarları yoksa hiçbir şey gönderilmez ve çağıran taraf bunu bilir
 * (gönderiyormuş gibi davranılmaz).
 */
import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../lib/env';

let transporter: Transporter | null = null;

export function isEmailConfigured() {
  return Boolean(env.SMTP_HOST && env.MAIL_FROM);
}

export async function sendMail(opts: { to: string; subject: string; text: string; html?: string }) {
  if (!isEmailConfigured()) return { sent: false as const, reason: 'NOT_CONFIGURED' as const };
  transporter ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });
  try {
    await transporter.sendMail({ from: env.MAIL_FROM, ...opts });
    return { sent: true as const };
  } catch (e) {
    return { sent: false as const, reason: 'FAILED' as const, error: (e as Error).message };
  }
}
