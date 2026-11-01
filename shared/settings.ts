/**
 * Web sitesi içerik & ayar şemaları.
 * - Sunucu: PATCH /api/settings/:key gövdesini bu şemalarla doğrular.
 * - İstemci: API'ye ulaşılamazsa bu varsayılanlarla çizer (fallback).
 * - Seed: ilk kurulumda website_settings tablosuna bu değerleri yazar.
 *
 * Metinlerde uzmanlık, eğitim, deneyim yılı, sertifika vb. doğrulanmamış bilgi YOKTUR.
 */
import { z } from 'zod';

const text = (max = 400) => z.string().trim().max(max);
const nullableText = (max = 400) => z.string().trim().max(max).nullable();
const url = z
  .string()
  .trim()
  .max(500)
  .refine((v) => /^https:\/\//i.test(v), 'Bağlantı https:// ile başlamalı')
  .nullable();

export const heroSchema = z.object({
  eyebrow: text(80),
  titleLine1: text(40),
  titleLine2: text(40),
  description: text(240),
  primaryCta: text(30),
  secondaryCta: text(30),
  features: z.array(text(60)).length(3),
});

export const introSchema = z.object({
  heading: text(160),
  body: text(900),
  aside: text(240),
});

export const aboutSchema = z.object({
  eyebrow: text(60),
  heading: text(160),
  lead: text(500),
  paragraphs: z.array(text(1200)).max(6),
  pillars: z.array(z.object({ title: text(60), body: text(300) })).max(6),
  /** Doğrulanmış eğitim/sertifika bilgileri — boşsa sitede gösterilmez */
  credentials: z.array(z.object({ label: text(80), value: text(200) })).max(10),
});

export const approachSchema = z.object({
  heading: text(120),
  subheading: text(240),
  pillars: z.array(z.object({ title: text(60), body: text(300) })).length(3),
});

export const processSchema = z.object({
  heading: text(120),
  intro: text(300),
  steps: z.array(z.object({ title: text(40), body: text(240) })).min(2).max(6),
});

export const ctaSchema = z.object({
  heading: text(160),
  body: text(240),
  button: text(30),
});

export const contactSchema = z.object({
  phone: nullableText(30),
  whatsapp: z
    .string()
    .trim()
    .regex(/^\d{10,15}$/, 'Yalnızca rakam, ülke koduyla (ör. 905xxxxxxxxx)')
    .nullable(),
  email: z.string().trim().email('Geçerli bir e-posta girin').nullable(),
  addressLine: nullableText(240),
  district: nullableText(80),
  city: nullableText(80),
  postalCode: nullableText(10),
  mapEmbedUrl: url.refine(
    (v) => v === null || v.startsWith('https://www.google.com/maps/embed') || (v.startsWith('https://www.google.com/maps?') && v.includes('output=embed')),
    'Google Haritalar "Yerleştir" bağlantısı olmalı (https://www.google.com/maps/embed?... veya ...&output=embed)',
  ),
  mapLinkUrl: url,
  venueName: nullableText(120),
  venueNote: nullableText(240),
  hoursNote: nullableText(160),
});

export const socialSchema = z.object({
  instagram: url,
  youtube: url,
  x: url,
  linkedin: url,
});

export const businessSchema = z.object({
  brandName: text(60).min(1),
  title: text(60).min(1),
  legalName: nullableText(160),
  kvkkContactEmail: z.string().trim().email().nullable(),
});

export const seoSchema = z.object({
  defaultTitle: text(70),
  titleSuffix: text(40),
  defaultDescription: text(170),
});

export const appointmentSettingsSchema = z.object({
  /** Web sitesinden en erken kaç saat sonrası için talep alınır */
  leadTimeHours: z.number().int().min(0).max(168),
  /** Web sitesinden en fazla kaç gün ilerisi için talep alınır */
  maxDaysAhead: z.number().int().min(1).max(180),
  inPersonEnabled: z.boolean(),
  onlineEnabled: z.boolean(),
  /** Saat seçmeden "benimle iletişime geçin" talebine izin ver */
  allowRequestWithoutTime: z.boolean(),
  /** Talep formunun altında gösterilen bilgi notu */
  formNote: text(300),
});

export const kvkkSettingsSchema = z.object({
  /** Pasif danışan verilerinin saklama süresi (ay). Süre sonunda `npm run data:retention` anonimleştirir. */
  retentionMonths: z.number().int().min(6).max(240),
  /** Aydınlatma metni sürümü */
  noticeVersion: text(40),
  /** Hukuki inceleme tamamlandı mı? Tamamlanmadıysa yasal sayfalarda "taslak" uyarısı gösterilir. */
  legalReviewCompleted: z.boolean(),
});

/** Panelden yüklenen, sunucuda varyantları üretilmiş görsel (bkz. POST /api/content/site-images) */
export const siteImageSchema = z.object({
  /** Varyant taban yolu: <base>-<genişlik>.webp / .avif */
  base: z.string().regex(/^\/uploads\/public\/site\/[a-z0-9]+$/, 'Geçersiz görsel yolu'),
  widths: z.array(z.number().int().min(16).max(4000)).min(1).max(6),
  width: z.number().int().min(1),
  height: z.number().int().min(1),
  alt: z.string().trim().min(3, 'Görseli kısaca tarif edin (erişilebilirlik ve SEO için)').max(300),
  /** Odak noktası (object-position, %): kırpma telefonda ve masaüstünde buraya göre yapılır */
  focusX: z.number().min(0).max(100).default(50),
  focusY: z.number().min(0).max(100).default(50),
});
export type SiteImage = z.infer<typeof siteImageSchema>;

export const mediaSchema = z.object({
  /** Ana sayfa kapak fotoğrafı (mekân). Boşsa yerleşik mekân fotoğrafı kullanılır. */
  hero: siteImageSchema.nullable(),
  /** Görüşme alanı fotoğrafı (iletişim bölümü, randevu sayfası). Boşsa yerleşik fotoğraf kullanılır. */
  venue: siteImageSchema.nullable(),
  /** Nida Akın portresi. Boşsa zarif bir yer tutucu gösterilir (stok fotoğraf kullanılmaz). */
  portrait: siteImageSchema.nullable(),
});

export const settingsSchemas = {
  hero: heroSchema,
  intro: introSchema,
  about: aboutSchema,
  approach: approachSchema,
  process: processSchema,
  cta: ctaSchema,
  contact: contactSchema,
  social: socialSchema,
  business: businessSchema,
  seo: seoSchema,
  appointment: appointmentSettingsSchema,
  kvkk: kvkkSettingsSchema,
  media: mediaSchema,
} as const;

export type SettingsKey = keyof typeof settingsSchemas;
export const SETTINGS_KEYS = Object.keys(settingsSchemas) as SettingsKey[];
export type Settings = { [K in SettingsKey]: z.infer<(typeof settingsSchemas)[K]> };

/** Herkese açık API'de dönülen ayar anahtarları (kvkk.retention gibi iç ayarlar dahil değil) */
export const PUBLIC_SETTINGS_KEYS: SettingsKey[] = [
  'hero', 'intro', 'about', 'approach', 'process', 'cta', 'contact', 'social', 'business', 'seo', 'appointment', 'media',
];

export { defaultSettings } from './settings-defaults';
