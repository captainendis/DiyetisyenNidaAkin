// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Panelden yönetilen SMTP ve WhatsApp (Cloud API) ayarlarının şemaları ve yardımcıları.
 * Gizli değerler (SMTP şifresi, WhatsApp erişim anahtarı) bu dosyadaki "görünüm" tiplerinde YOKTUR:
 * istemciye yalnızca `hasPassword` / `hasToken` döner. Şifrelenmiş saklama biçimi sunucuya aittir.
 */
import { z } from 'zod';

const t = (max: number) => z.string().trim().max(max);

// ───────────── SMTP ─────────────

export const smtpInputSchema = z.object({
  host: t(255),
  port: z.number().int().min(1, 'Geçerli bir port girin').max(65535, 'Geçerli bir port girin'),
  /** true: doğrudan TLS (genellikle 465). false: STARTTLS (genellikle 587). */
  secure: z.boolean(),
  username: t(200),
  /** Boş bırakılırsa mevcut şifre korunur. */
  password: z.string().max(500).optional(),
  fromName: t(100),
  fromEmail: z.union([z.literal(''), z.string().trim().email('Geçerli bir e-posta girin').max(200)]),
});
export type SmtpInput = z.infer<typeof smtpInputSchema>;

export interface SmtpSettingsView {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  fromName: string;
  fromEmail: string;
  hasPassword: boolean;
}

export const defaultSmtpView: SmtpSettingsView = {
  host: '', port: 587, secure: false, username: '', fromName: '', fromEmail: '', hasPassword: false,
};

// ───────────── WhatsApp Cloud API ─────────────

const templateName = z
  .string()
  .trim()
  .max(512)
  .refine((v) => v === '' || /^[a-z0-9_]+$/.test(v), 'Şablon adı yalnızca küçük harf, rakam ve alt çizgi içerir');

export const whatsappCloudInputSchema = z.object({
  enabled: z.boolean(),
  phoneNumberId: z.string().trim().max(40).refine((v) => v === '' || /^\d+$/.test(v), 'Telefon numarası kimliği yalnızca rakamlardan oluşur'),
  /** Boş bırakılırsa mevcut erişim anahtarı korunur. */
  accessToken: z.string().trim().max(1000).optional(),
  apiVersion: z.string().trim().regex(/^v\d{1,2}\.\d{1,2}$/, 'Sürüm v21.0 biçiminde olmalı'),
  templateLanguage: z.string().trim().regex(/^[a-z]{2}(_[A-Z]{2})?$/, 'Dil kodu tr veya tr_TR gibi olmalı'),
  /** Personel bildirimlerinin gideceği numara: yalnızca rakam, ülke koduyla */
  staffNumber: z.string().trim().refine((v) => v === '' || /^\d{10,15}$/.test(v), 'Yalnızca rakam, ülke koduyla (ör. 905xxxxxxxxx)'),
  templates: z.object({
    requestStaff: templateName,
    confirmedClient: templateName,
    reminderClient: templateName,
  }),
});
export type WhatsappCloudInput = z.infer<typeof whatsappCloudInputSchema>;

export interface WhatsappCloudView extends Omit<WhatsappCloudInput, 'accessToken'> {
  hasToken: boolean;
}

export const defaultWhatsappCloudView: WhatsappCloudView = {
  enabled: false,
  phoneNumberId: '',
  apiVersion: 'v21.0',
  templateLanguage: 'tr',
  staffNumber: '',
  templates: { requestStaff: '', confirmedClient: '', reminderClient: '' },
  hasToken: false,
};

/** Şablon başına sıralı gövde parametreleri (Meta şablonundaki {{1}}, {{2}}… sırası) */
export const WHATSAPP_TEMPLATE_PARAMS = {
  requestStaff: ['Talep başlığı', 'Talep özeti', 'Referans'],
  confirmedClient: ['Ad', 'Tarih', 'Saat', 'Referans'],
  reminderClient: ['Ad', 'Tarih', 'Saat'],
} as const;

export { defaultWhatsappTemplates, fillTemplate, toWhatsappNumber, WHATSAPP_PLACEHOLDERS, WHATSAPP_TEMPLATE_LABEL } from './whatsapp-templates';
export type { WhatsappTemplates, WhatsappTemplateKey } from './whatsapp-templates';

export const whatsappTemplatesSchema = z.object({
  requestReceived: t(1000).min(1, 'Metin gerekli'),
  appointmentConfirmed: t(1000).min(1, 'Metin gerekli'),
  reminder: t(1000).min(1, 'Metin gerekli'),
  pilatesInfo: t(1000).min(1, 'Metin gerekli'),
});
