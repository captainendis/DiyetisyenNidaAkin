// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Panelden girilen SMTP ve WhatsApp Cloud API ayarlarının saklanması.
 * website_settings tablosunda, herkese açık/içerik API'lerinin okumadığı ayrı anahtarlarda tutulur.
 * Şifre ve erişim anahtarı AES-GCM ile şifrelenir; istemciye yalnızca hasPassword/hasToken döner.
 */
import { prisma } from '../lib/db';
import { decryptString, encryptString } from '../lib/crypto';
import {
  defaultSmtpView, defaultWhatsappCloudView, smtpInputSchema, whatsappCloudInputSchema,
  type SmtpInput, type SmtpSettingsView, type WhatsappCloudInput, type WhatsappCloudView,
} from '../../shared/integrations';

const SMTP_KEY = 'integration.smtp';
const WA_KEY = 'integration.whatsappCloud';

interface SmtpStored extends Omit<SmtpSettingsView, 'hasPassword'> { passwordEnc: string | null }
interface WaStored extends Omit<WhatsappCloudView, 'hasToken'> { tokenEnc: string | null }

async function read<T>(key: string): Promise<Partial<T> | null> {
  const row = await prisma.websiteSetting.findUnique({ where: { key } });
  return row ? (row.value as Partial<T>) : null;
}

async function write(key: string, value: object, userId?: string) {
  await prisma.websiteSetting.upsert({
    where: { key },
    create: { key, value: value as never, updatedById: userId ?? null },
    update: { value: value as never, updatedById: userId ?? null },
  });
}

// ───────────── SMTP ─────────────

async function loadSmtpStored(): Promise<SmtpStored> {
  const { hasPassword: _h, ...base } = defaultSmtpView;
  return { ...base, passwordEnc: null, ...(await read<SmtpStored>(SMTP_KEY)) };
}

/** İstemciye dönebilen görünüm: şifre yok */
export async function getSmtpView(): Promise<SmtpSettingsView> {
  const { passwordEnc, ...rest } = await loadSmtpStored();
  return { ...rest, hasPassword: Boolean(passwordEnc) };
}

/** Gönderim için çözülmüş yapılandırma (yalnızca sunucu içinde kullanılır) */
export async function getSmtpSecret(): Promise<(Omit<SmtpStored, 'passwordEnc'> & { password: string }) | null> {
  const { passwordEnc, ...rest } = await loadSmtpStored();
  if (!rest.host) return null;
  let password = '';
  if (passwordEnc) {
    try {
      password = decryptString(passwordEnc);
    } catch {
      console.error('SMTP şifresi çözülemedi (şifreleme anahtarı değişmiş olabilir)');
    }
  }
  return { ...rest, password };
}

export async function saveSmtp(input: SmtpInput, userId?: string): Promise<SmtpSettingsView> {
  const cur = await loadSmtpStored();
  const { password, ...fields } = smtpInputSchema.parse(input);
  await write(SMTP_KEY, { ...fields, passwordEnc: password ? encryptString(password) : cur.passwordEnc }, userId);
  return getSmtpView();
}

// ───────────── WhatsApp Cloud API ─────────────

async function loadWaStored(): Promise<WaStored> {
  const { hasToken: _h, ...base } = defaultWhatsappCloudView;
  const saved = await read<WaStored>(WA_KEY);
  return { ...base, tokenEnc: null, ...saved, templates: { ...base.templates, ...(saved?.templates ?? {}) } };
}

export async function getWhatsappView(): Promise<WhatsappCloudView> {
  const { tokenEnc, ...rest } = await loadWaStored();
  return { ...rest, hasToken: Boolean(tokenEnc) };
}

export interface WhatsappSecret extends Omit<WaStored, 'tokenEnc'> { token: string }

/** Gönderime hazır yapılandırma; etkin değilse ya da eksikse null */
export async function getWhatsappSecret(opts: { requireEnabled?: boolean } = { requireEnabled: true }): Promise<WhatsappSecret | null> {
  const { tokenEnc, ...rest } = await loadWaStored();
  if ((opts.requireEnabled ?? true) && !rest.enabled) return null;
  if (!rest.phoneNumberId || !tokenEnc) return null;
  try {
    return { ...rest, token: decryptString(tokenEnc) };
  } catch {
    console.error('WhatsApp erişim anahtarı çözülemedi (şifreleme anahtarı değişmiş olabilir)');
    return null;
  }
}

export async function saveWhatsapp(input: WhatsappCloudInput, userId?: string): Promise<WhatsappCloudView> {
  const cur = await loadWaStored();
  const { accessToken, ...fields } = whatsappCloudInputSchema.parse(input);
  await write(WA_KEY, { ...fields, tokenEnc: accessToken ? encryptString(accessToken) : cur.tokenEnc }, userId);
  return getWhatsappView();
}
