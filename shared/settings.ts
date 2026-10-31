/**
 * Web sitesi içerik & ayar şemaları.
 * - Sunucu: PATCH /api/settings/:key gövdesini bu şemalarla doğrular.
 * - İstemci: API'ye ulaşılamazsa bu varsayılanlarla çizer (fallback).
 * - Seed: ilk kurulumda website_settings tablosuna bu değerleri yazar.
 *
 * Metinlerde uzmanlık, eğitim, deneyim yılı, sertifika vb. doğrulanmamış bilgi YOKTUR.
 */
import { z } from 'zod';
import { siteConfig } from './site-config';

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
  signature: text(60),
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
} as const;

export type SettingsKey = keyof typeof settingsSchemas;
export const SETTINGS_KEYS = Object.keys(settingsSchemas) as SettingsKey[];
export type Settings = { [K in SettingsKey]: z.infer<(typeof settingsSchemas)[K]> };

/** Herkese açık API'de dönülen ayar anahtarları (kvkk.retention gibi iç ayarlar dahil değil) */
export const PUBLIC_SETTINGS_KEYS: SettingsKey[] = [
  'hero', 'intro', 'about', 'approach', 'process', 'cta', 'contact', 'social', 'business', 'seo', 'appointment',
];

export const defaultSettings: Settings = {
  hero: {
    eyebrow: 'Sağlıklı yaşam, doğru beslenme ile başlar',
    titleLine1: 'Nida Akın',
    titleLine2: 'Diyetisyen',
    description: 'Daha sağlıklı, dengeli ve enerjik bir yaşam için size özel beslenme danışmanlığı.',
    primaryCta: 'Randevu Al',
    secondaryCta: 'Yakından Tanıyın',
    features: ['Kişiye Özel Beslenme Planı', 'Sağlıklı Yaşam Danışmanlığı', 'Sürdürülebilir Beslenme'],
  },
  intro: {
    heading: 'İyi hissetmek, kendin için attığın küçük bir adımla başlar.',
    body:
      'Beslenme; listelerden, yasaklardan ve kısa süreli kararlardan çok daha fazlası. Günlük ritminizi, sevdiğiniz tatları ve hayatınızın gerçek koşullarını anlamadan kalıcı bir değişim planlanamaz. Bu yüzden her görüşme, sizi dinlemekle başlar.',
    aside: 'Sizin hayatınıza uyan bir plan — tersi değil.',
  },
  about: {
    eyebrow: 'Hakkımda',
    heading: 'Dinleyen, birlikte planlayan, süreç boyunca yanınızda olan bir danışmanlık.',
    lead:
      'Beslenmeyi bir disiplin cezası olarak değil, kendinize gösterdiğiniz özenin bir parçası olarak görüyorum. Amacım, sizin için işleyen ve uzun vadede sürdürebileceğiniz alışkanlıkları birlikte bulmak.',
    paragraphs: [
      'Danışmanlık sürecinde önce sizi tanımaya odaklanıyorum: gününüz nasıl geçiyor, neleri seviyorsunuz, nerede zorlanıyorsunuz? Bu sorulara verdiğiniz cevaplar, planın kendisi kadar önemli.',
      'Hazır listeler yerine; yaşam tempounuza, alışkanlıklarınıza ve hedeflerinize göre şekillenen, gerektiğinde birlikte güncellediğimiz bir yol haritası hazırlıyoruz.',
    ],
    pillars: [
      { title: 'Önce dinlemek', body: 'Her plan, sizin hikâyenizi ve günlük ritminizi anlamakla başlar.' },
      { title: 'Gerçekçi hedefler', body: 'Küçük ama kalıcı adımlar; kısa süreli değil, sürdürülebilir değişim.' },
      { title: 'Yargısız yaklaşım', body: 'Mükemmel bir beslenme değil, size iyi gelen bir denge arıyoruz.' },
    ],
    // Gerçek eğitim, sertifika ve deneyim bilgileri doğrulandıktan sonra panelden eklenmelidir.
    credentials: [],
    signature: 'Nida Akın',
  },
  approach: {
    heading: 'Yasaklarla değil, dengeyle.',
    subheading: 'Beslenme, hayatından vazgeçmek değil; hayatına iyi gelecek alışkanlıklar kazanmaktır.',
    pillars: [
      { title: 'Sürdürülebilirlik', body: 'Birkaç hafta değil, yıllar boyunca uygulanabilecek alışkanlıklar üzerine kurulu bir yaklaşım.' },
      { title: 'Kişiye özel planlama', body: 'Yaşam tarzınız, tercihleriniz ve hedefleriniz doğrultusunda size özel hazırlanan bir plan.' },
      { title: 'Dengeli yaşam', body: 'Sofradaki keyfi korurken bedeninize iyi gelecek seçimleri birlikte keşfetmek.' },
    ],
  },
  process: {
    heading: 'Süreç nasıl işliyor?',
    intro: 'İlk görüşmeden takip sürecine kadar her adım, sizin ihtiyaçlarınıza göre şekillenir.',
    steps: [
      { title: 'Tanışma', body: 'İhtiyaçların ve hedeflerin belirlenmesi.' },
      { title: 'Değerlendirme', body: 'Kişiye özel beslenme ihtiyaçlarının değerlendirilmesi.' },
      { title: 'Planlama', body: 'Bireysel ihtiyaçlara uygun beslenme planının hazırlanması.' },
      { title: 'Takip', body: 'Sürecin değerlendirilmesi ve gerektiğinde güncellenmesi.' },
    ],
  },
  cta: {
    heading: 'Değişim, kendine ayırdığın zamanla başlar.',
    body: 'Sağlıklı yaşam yolculuğuna ilk adımını at.',
    button: 'Randevu Oluştur',
  },
  contact: { ...siteConfig.contact },
  social: { ...siteConfig.social },
  business: { ...siteConfig.business },
  seo: {
    defaultTitle: 'Nida Akın — Diyetisyen',
    titleSuffix: ' | Nida Akın Diyetisyen',
    defaultDescription:
      'Diyetisyen Nida Akın ile kişiye özel, sürdürülebilir beslenme danışmanlığı. Yasaklarla değil, dengeyle. Randevu talebinizi çevrim içi oluşturun.',
  },
  appointment: {
    leadTimeHours: 12,
    maxDaysAhead: 45,
    inPersonEnabled: true,
    onlineEnabled: true,
    allowRequestWithoutTime: true,
    formNote:
      'Gönderdiğiniz talep bir ön başvurudur. Randevunuz, uygunluk kontrolünden sonra sizinle iletişime geçilerek kesinleştirilir.',
  },
  kvkk: {
    retentionMonths: 36,
    noticeVersion: '2026-10-taslak',
    legalReviewCompleted: false,
  },
};
