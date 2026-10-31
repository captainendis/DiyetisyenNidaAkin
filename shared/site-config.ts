/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  MERKEZİ SİTE YAPILANDIRMASI
 * ─────────────────────────────────────────────────────────────────────────────
 *  Doğrulanmamış hiçbir bilgi burada uydurulmamıştır. `null` olan alanlar
 *  bilinçli olarak boş bırakılmıştır ve doğrulandıktan sonra doldurulmalıdır.
 *
 *  Bu dosya veritabanı ilk kurulumunda (npm run db:seed) "website_settings"
 *  tablosuna aktarılır. Kurulumdan sonra bu değerler panelden
 *  (/panel/icerikler → İletişim & Sosyal) yönetilir; panelde kaydedilen değer
 *  her zaman bu dosyadaki varsayılanın önüne geçer.
 *
 *  Boş alanlar:
 *   - Web sitesinde "yakında eklenecek" şeklinde zarif bir yer tutucu ile gösterilir.
 *   - Schema.org (yapılandırılmış veri) içine ASLA yazılmaz.
 *   - WhatsApp numarası boşsa WhatsApp yönlendirmeleri gizlenir.
 */

export interface ContactInfo {
  /** Uluslararası formatta, ör. "+90 5xx xxx xx xx" */
  phone: string | null;
  /** Yalnızca rakam, ülke koduyla, ör. "905xxxxxxxxx" (wa.me bağlantısı için) */
  whatsapp: string | null;
  email: string | null;
  /** Açık adres */
  addressLine: string | null;
  district: string | null;
  city: string | null;
  postalCode: string | null;
  /** Google Haritalar "Yerleştir" (embed) bağlantısı — yalnızca https://www.google.com/maps/embed?... */
  mapEmbedUrl: string | null;
  /** Yol tarifi için Google Haritalar paylaşım bağlantısı */
  mapLinkUrl: string | null;
  /** Ziyaretçiye gösterilecek çalışma saatleri metni (ör. "Hafta içi 10.00 – 19.00"). Uydurulmamalı. */
  hoursNote: string | null;
}

export interface SocialLinks {
  instagram: string | null;
  youtube: string | null;
  x: string | null;
  linkedin: string | null;
}

export interface BusinessInfo {
  brandName: string;
  title: string;
  /** Resmi unvan / ticari ad (KVKK veri sorumlusu bilgisi için) */
  legalName: string | null;
  /** Veri sorumlusu iletişim e-postası (KVKK başvuruları) */
  kvkkContactEmail: string | null;
}

export const siteConfig = {
  business: {
    brandName: 'Nida Akın',
    title: 'Diyetisyen',
    legalName: null,
    kvkkContactEmail: null,
  } satisfies BusinessInfo,

  contact: {
    phone: null,
    whatsapp: null,
    email: null,
    addressLine: null,
    district: null,
    city: null,
    postalCode: null,
    mapEmbedUrl: null,
    mapLinkUrl: null,
    hoursNote: null,
  } satisfies ContactInfo,

  social: {
    instagram: null,
    youtube: null,
    x: null,
    linkedin: null,
  } satisfies SocialLinks,

  /** Saat dilimi — tüm randevu hesapları bu dilimde yapılır. */
  timeZone: 'Europe/Istanbul',
  locale: 'tr-TR',
} as const;

export type SiteConfig = typeof siteConfig;
