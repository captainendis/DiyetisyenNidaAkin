// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** İstemci ve sunucu tarafından paylaşılan sabitler ve Türkçe etiketler. */

export const TIME_ZONE = 'Europe/Istanbul';

export const APPOINTMENT_STATUSES = [
  'NEW_REQUEST',
  'PENDING',
  'CONFIRMED',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const APPOINTMENT_STATUS_LABEL: Record<AppointmentStatus, string> = {
  NEW_REQUEST: 'Yeni Talep',
  PENDING: 'Onay Bekliyor',
  CONFIRMED: 'Onaylandı',
  COMPLETED: 'Tamamlandı',
  CANCELLED: 'İptal Edildi',
  NO_SHOW: 'Gelmedi',
};

/** Takvimde zaman dilimini kaplayan (başka bir talebin seçemeyeceği) durumlar */
export const SLOT_HOLDING_STATUSES: AppointmentStatus[] = ['PENDING', 'CONFIRMED', 'COMPLETED'];
/** Kesin çakışma kontrolü uygulanan durumlar (veritabanı exclusion constraint ile aynı) */
export const HARD_CONFLICT_STATUSES: AppointmentStatus[] = ['CONFIRMED', 'COMPLETED'];
/** Sonlanmış (artık değiştirilmesi beklenmeyen) durumlar */
export const FINAL_STATUSES: AppointmentStatus[] = ['COMPLETED', 'CANCELLED', 'NO_SHOW'];

export const MEETING_TYPES = ['IN_PERSON', 'ONLINE'] as const;
export type MeetingType = (typeof MEETING_TYPES)[number];
export const MEETING_TYPE_LABEL: Record<MeetingType, string> = {
  IN_PERSON: 'Yüz yüze',
  ONLINE: 'Online',
};

/** Talebin konusu — pilates talepleri de randevular listesine düşer */
export const APPOINTMENT_KINDS = ['CONSULTATION', 'PILATES'] as const;
export type AppointmentKind = (typeof APPOINTMENT_KINDS)[number];
export const APPOINTMENT_KIND_LABEL: Record<AppointmentKind, string> = {
  CONSULTATION: 'Beslenme görüşmesi',
  PILATES: 'Pilates',
};

export const PILATES_FORMATS = ['GROUP', 'PRIVATE'] as const;
export type PilatesFormat = (typeof PILATES_FORMATS)[number];
export const PILATES_FORMAT_LABEL: Record<PilatesFormat, string> = {
  GROUP: 'Grup dersi',
  PRIVATE: 'Birebir ders',
};

/** Pilates talebinde gün içi tercih (çalışma saatleri 09.00–21.00) */
export const DAYPARTS = ['MORNING', 'AFTERNOON', 'EVENING'] as const;
export type Daypart = (typeof DAYPARTS)[number];
export const DAYPART_LABEL: Record<Daypart, string> = {
  MORNING: 'Sabah',
  AFTERNOON: 'Öğleden sonra',
  EVENING: 'Akşam',
};
export const DAYPART_HOURS: Record<Daypart, string> = {
  MORNING: '09.00–12.00',
  AFTERNOON: '12.00–17.00',
  EVENING: '17.00–21.00',
};

/** "1,3,5" ↔ [1,3,5] — tercih alanları veritabanında virgüllü metin olarak tutulur */
export const parseDays = (v: string | null | undefined) =>
  (v ?? '').split(',').map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 7);
export const parseDayparts = (v: string | null | undefined) =>
  (v ?? '').split(',').filter((x): x is Daypart => (DAYPARTS as readonly string[]).includes(x));

const WEEKDAY_SHORT = ['', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
/** "Pzt, Çar · Sabah" — boş tercihler "fark etmez" olarak yazılır */
export function pilatesPreferenceText(days: string | number[] | null | undefined, dayparts: string | Daypart[] | null | undefined) {
  const d = Array.isArray(days) ? days : parseDays(days);
  const p = Array.isArray(dayparts) ? dayparts : parseDayparts(dayparts);
  const dayText = d.length ? d.map((n) => WEEKDAY_SHORT[n]).join(', ') : 'Gün fark etmez';
  const partText = p.length ? p.map((x) => DAYPART_LABEL[x]).join(', ') : 'saat fark etmez';
  return `${dayText} · ${partText}`;
}

export const CLIENT_STATUSES = ['ACTIVE', 'PASSIVE', 'ARCHIVED'] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];
export const CLIENT_STATUS_LABEL: Record<ClientStatus, string> = {
  ACTIVE: 'Aktif',
  PASSIVE: 'Pasif',
  ARCHIVED: 'Arşivlendi',
};

export const NOTIFICATION_TYPES = [
  'APPOINTMENT_REQUESTED',
  'APPOINTMENT_CONFIRMED',
  'APPOINTMENT_CANCELLED',
  'APPOINTMENT_UPCOMING',
  'CLIENT_CREATED',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
export const NOTIFICATION_TYPE_LABEL: Record<NotificationType, string> = {
  APPOINTMENT_REQUESTED: 'Yeni randevu talebi',
  APPOINTMENT_CONFIRMED: 'Randevu onaylandı',
  APPOINTMENT_CANCELLED: 'Randevu iptal edildi',
  APPOINTMENT_UPCOMING: 'Yaklaşan randevu',
  CLIENT_CREATED: 'Yeni danışan kaydı',
};

export const BLOCKED_DATE_KINDS = ['FULL_DAY', 'CUSTOM_HOURS', 'TIME_RANGE'] as const;
export type BlockedDateKind = (typeof BLOCKED_DATE_KINDS)[number];
export const BLOCKED_DATE_KIND_LABEL: Record<BlockedDateKind, string> = {
  FULL_DAY: 'Tüm gün kapalı',
  CUSTOM_HOURS: 'Özel çalışma saatleri',
  TIME_RANGE: 'Saat aralığı kapalı',
};
export const BLOCKED_DATE_REASONS = ['HOLIDAY', 'LEAVE', 'MANUAL', 'OTHER'] as const;
export type BlockedDateReason = (typeof BLOCKED_DATE_REASONS)[number];
export const BLOCKED_DATE_REASON_LABEL: Record<BlockedDateReason, string> = {
  HOLIDAY: 'Resmî tatil',
  LEAVE: 'İzin',
  MANUAL: 'Takvim kapatıldı',
  OTHER: 'Diğer',
};

export const POST_STATUSES = ['DRAFT', 'PUBLISHED', 'UNPUBLISHED'] as const;
export type PostStatus = (typeof POST_STATUSES)[number];
export const POST_STATUS_LABEL: Record<PostStatus, string> = {
  DRAFT: 'Taslak',
  PUBLISHED: 'Yayında',
  UNPUBLISHED: 'Yayından kaldırıldı',
};

/** ISO gün numarası (1 = Pazartesi) → Türkçe ad */
export const WEEKDAY_LABEL: Record<number, string> = {
  1: 'Pazartesi',
  2: 'Salı',
  3: 'Çarşamba',
  4: 'Perşembe',
  5: 'Cuma',
  6: 'Cumartesi',
  7: 'Pazar',
};

export const ROLE_LABEL: Record<'ADMIN' | 'DIETITIAN' | 'ASSISTANT', string> = {
  ADMIN: 'Yönetici',
  DIETITIAN: 'Diyetisyen',
  ASSISTANT: 'Asistan',
};

/** Hizmet kartlarında kullanılabilecek özel çizgi-ikon anahtarları */
export const SERVICE_ICONS = ['plate', 'scale', 'leaf', 'cycle', 'screen', 'notebook', 'apple', 'sprout'] as const;
export type ServiceIconKey = (typeof SERVICE_ICONS)[number];

/** Blog kategorileri (ilk kurulum için) */
export const DEFAULT_BLOG_CATEGORIES = [
  { slug: 'saglikli-beslenme', name: 'Sağlıklı Beslenme' },
  { slug: 'gunluk-beslenme', name: 'Günlük Beslenme' },
  { slug: 'besinler-ve-icerikleri', name: 'Besinler ve İçerikleri' },
  { slug: 'beslenme-aliskanliklari', name: 'Beslenme Alışkanlıkları' },
  { slug: 'sik-sorulan-sorular', name: 'Sık Sorulan Sorular' },
] as const;

/** KVKK metin sürümü — metin değiştiğinde artırın; rıza kayıtları sürümle ilişkilendirilir */
export const KVKK_NOTICE_VERSION = '2026-10-taslak';

// ───────────────────────── Grup dersleri (Pilates) ─────────────────────────

export const CLASS_SESSION_STATUSES = ['SCHEDULED', 'COMPLETED', 'CANCELLED'] as const;
export type ClassSessionStatus = (typeof CLASS_SESSION_STATUSES)[number];
export const CLASS_SESSION_STATUS_LABEL: Record<ClassSessionStatus, string> = {
  SCHEDULED: 'Planlandı',
  COMPLETED: 'Yapıldı',
  CANCELLED: 'İptal',
};
/** Takvimde zaman kaplayan ders durumları */
export const CLASS_BLOCKING_STATUSES: ClassSessionStatus[] = ['SCHEDULED', 'COMPLETED'];

export const CLASS_ATTENDANCE_STATUSES = ['BOOKED', 'ATTENDED', 'NO_SHOW', 'EXCUSED'] as const;
export type ClassAttendanceStatus = (typeof CLASS_ATTENDANCE_STATUSES)[number];
export const CLASS_ATTENDANCE_LABEL: Record<ClassAttendanceStatus, string> = {
  BOOKED: 'Kayıtlı',
  ATTENDED: 'Katıldı',
  NO_SHOW: 'Gelmedi',
  EXCUSED: 'Haber verdi',
};
/** Kontenjandan yer tutan katılım durumları (haber veren kişinin yeri boşalır) */
export const CLASS_SEAT_HOLDING: ClassAttendanceStatus[] = ['BOOKED', 'ATTENDED', 'NO_SHOW'];

/** Grup dersi kontenjanı sınırları (pilates grupları için varsayılan 3 kişi) */
export const CLASS_CAPACITY_DEFAULT = 3;
export const CLASS_CAPACITY_MAX = 12;
