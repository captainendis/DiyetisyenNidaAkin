// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * API giriş doğrulama şemaları (Zod). İstemci formları ve sunucu aynı şemaları kullanır.
 */
import { z } from 'zod';
import { CIRCUMFERENCES, type CircumferenceKey } from './measurements';
import {
  APPOINTMENT_STATUSES,
  BLOCKED_DATE_KINDS,
  CLASS_ATTENDANCE_STATUSES,
  CLASS_CAPACITY_DEFAULT,
  CLASS_CAPACITY_MAX,
  CLASS_SESSION_STATUSES,
  BLOCKED_DATE_REASONS,
  CLIENT_STATUSES,
  MEETING_TYPES,
  APPOINTMENT_KINDS,
  PILATES_FORMATS,
  DAYPARTS,
  POST_STATUSES,
  SERVICE_ICONS,
} from './constants';

export const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tarih YYYY-AA-GG biçiminde olmalı');
export const timeStr = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Saat SS:dd biçiminde olmalı');

/** Türkiye ve uluslararası telefon numaraları için esnek ama anlamlı kontrol */
export const phoneSchema = z
  .string()
  .trim()
  .min(1, 'Telefon numarası gerekli')
  .transform((v) => v.replace(/[\s().-]/g, ''))
  .refine((v) => /^(\+?90|0)?5\d{9}$/.test(v) || /^\+\d{10,15}$/.test(v), 'Geçerli bir telefon numarası girin (ör. 05xx xxx xx xx)')
  .transform((v) => {
    // Türkiye cep numaralarını +90 biçimine normalize et
    const m = v.match(/^(?:\+?90|0)?(5\d{9})$/);
    return m ? `+90${m[1]}` : v;
  });

export const emailSchema = z.string().trim().toLowerCase().email('Geçerli bir e-posta adresi girin').max(160);
const optionalEmail = z
  .union([emailSchema, z.literal('')])
  .optional()
  .nullable()
  .transform((v) => (v ? v : null));

const personName = z
  .string()
  .trim()
  .min(2, 'En az 2 karakter girin')
  .max(80)
  .regex(/^[\p{L}\s'.-]+$/u, 'Yalnızca harf kullanın');

// ───────────────────────── Web sitesi randevu talebi ─────────────────────────

export const publicAppointmentRequestSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(3, 'Adınızı ve soyadınızı girin')
      .max(120)
      .regex(/^[\p{L}\s'.-]+$/u, 'Yalnızca harf kullanın')
      .refine((v) => v.split(/\s+/).filter(Boolean).length >= 2, 'Adınızı ve soyadınızı birlikte yazın'),
    phone: phoneSchema,
    email: emailSchema,
    meetingType: z.enum(MEETING_TYPES, { message: 'Görüşme tercihinizi seçin' }),
    kind: z.enum(APPOINTMENT_KINDS).default('CONSULTATION'),
    /** Pilates talebi: grup ya da birebir; tercih edilen günler ve gün içi aralıklar (boşsa fark etmez) */
    pilatesFormat: z.enum(PILATES_FORMATS, { message: 'Ders türünü seçin' }).optional().nullable(),
    preferredDays: z.array(z.number().int().min(1).max(7)).max(7).optional().nullable(),
    preferredDayparts: z.array(z.enum(DAYPARTS)).max(3).optional().nullable(),
    serviceId: z.string().max(40).optional().nullable(),
    /** "slot": belirli bir saat seçildi — "callback": saat seçmeden iletişim talebi */
    mode: z.enum(['slot', 'callback']),
    date: dateStr.optional().nullable(),
    time: timeStr.optional().nullable(),
    message: z.string().trim().max(1000, 'Mesaj en fazla 1000 karakter olabilir').optional().nullable(),
    kvkkNotice: z.literal(true, { message: 'Devam etmek için aydınlatma metnini onaylayın' }),
    explicitConsent: z.boolean().default(false),
    /** Bot tuzağı — insanlar bu alanı görmez, dolu gelirse istek reddedilir */
    website: z.string().max(0).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.kind === 'PILATES') {
      if (!v.pilatesFormat) ctx.addIssue({ code: 'custom', path: ['pilatesFormat'], message: 'Grup dersi mi birebir ders mi istediğinizi seçin' });
      if (v.mode !== 'callback') ctx.addIssue({ code: 'custom', path: ['mode'], message: 'Pilates ders saati sizinle birlikte planlanır' });
      if (v.meetingType !== 'IN_PERSON') ctx.addIssue({ code: 'custom', path: ['meetingType'], message: 'Pilates dersleri stüdyoda yapılır' });
      return;
    }
    if (v.mode === 'slot' && (!v.date || !v.time)) {
      ctx.addIssue({ code: 'custom', path: ['time'], message: 'Lütfen bir gün ve saat seçin' });
    }
  });
export type PublicAppointmentRequest = z.input<typeof publicAppointmentRequestSchema>;

// ───────────────────────── Kimlik doğrulama ─────────────────────────

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Şifrenizi girin').max(200),
  remember: z.boolean().optional().default(false),
});

/** Şifre politikası: en az 10 karakter, harf + rakam */
export const passwordPolicy = z
  .string()
  .min(10, 'Şifre en az 10 karakter olmalı')
  .max(200)
  .refine((v) => /[A-Za-zÇĞİÖŞÜçğıöşü]/.test(v) && /\d/.test(v), 'Şifre en az bir harf ve bir rakam içermeli');

export const forgotPasswordSchema = z.object({ email: emailSchema });
export const resetPasswordSchema = z.object({ token: z.string().min(20).max(200), password: passwordPolicy });
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Mevcut şifrenizi girin'),
  newPassword: passwordPolicy,
});

// ───────────────────────── Randevular (panel) ─────────────────────────

export const appointmentStatusSchema = z.enum(APPOINTMENT_STATUSES);

export const panelAppointmentCreateSchema = z.object({
  clientId: z.string().max(40).nullable().optional(),
  /** clientId yoksa yeni danışan bilgisi */
  contactName: z.string().trim().min(3).max(120).optional(),
  contactPhone: phoneSchema.optional(),
  contactEmail: optionalEmail,
  serviceId: z.string().max(40).nullable().optional(),
  date: dateStr,
  time: timeStr,
  durationMinutes: z.number().int().min(10).max(240).optional(),
  meetingType: z.enum(MEETING_TYPES),
  /** Diyet (beslenme görüşmesi) ya da pilates (birebir/özel ders) */
  kind: z.enum(APPOINTMENT_KINDS).default('CONSULTATION'),
  pilatesFormat: z.enum(PILATES_FORMATS).optional().nullable(),
  status: z.enum(['PENDING', 'CONFIRMED']).default('CONFIRMED'),
  internalNote: z.string().trim().max(2000).optional().nullable(),
  /** Çalışma saatleri dışına bilinçli olarak özel randevu oluştur (çakışma kontrolü yine yapılır) */
  allowOutsideHours: z.boolean().optional().default(false),
});

export const panelAppointmentUpdateSchema = z.object({
  date: dateStr.optional(),
  time: timeStr.optional(),
  durationMinutes: z.number().int().min(10).max(240).optional(),
  meetingType: z.enum(MEETING_TYPES).optional(),
  serviceId: z.string().max(40).nullable().optional(),
  internalNote: z.string().trim().max(2000).nullable().optional(),
  clientId: z.string().max(40).nullable().optional(),
  allowOutsideHours: z.boolean().optional().default(false),
});

export const appointmentStatusChangeSchema = z.object({
  status: appointmentStatusSchema,
  note: z.string().trim().max(500).optional().nullable(),
});

export const appointmentListQuerySchema = z.object({
  from: dateStr.optional(),
  to: dateStr.optional(),
  status: z.union([appointmentStatusSchema, z.array(appointmentStatusSchema)]).optional(),
  meetingType: z.enum(MEETING_TYPES).optional(),
  kind: z.enum(APPOINTMENT_KINDS).optional(),
  q: z.string().trim().max(80).optional(),
  clientId: z.string().max(40).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(25),
  sort: z.enum(['startsAt', '-startsAt', 'createdAt', '-createdAt']).default('-startsAt'),
});

// ───────────────────────── Danışanlar ─────────────────────────

export const clientCreateSchema = z.object({
  firstName: personName,
  lastName: personName,
  phone: phoneSchema,
  email: optionalEmail,
  birthDate: dateStr.nullable().optional(),
  firstVisitDate: dateStr.nullable().optional(),
  preferredMeetingType: z.enum(MEETING_TYPES).nullable().optional(),
  internalNote: z.string().trim().max(2000).nullable().optional(),
  kvkkNoticeGiven: z.boolean().optional().default(false),
});
export const clientUpdateSchema = clientCreateSchema
  .omit({ kvkkNoticeGiven: true })
  .partial()
  .extend({ status: z.enum(CLIENT_STATUSES).optional() });

export const clientListQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  status: z.enum(CLIENT_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  sort: z.enum(['name', '-createdAt', 'createdAt', '-lastVisit']).default('-createdAt'),
});

export const consultationNoteSchema = z.object({
  content: z.string().trim().min(1, 'Not boş olamaz').max(10000),
  appointmentId: z.string().max(40).nullable().optional(),
});

export const healthConsentSchema = z.object({
  granted: z.boolean(),
  note: z.string().trim().max(300).optional().nullable(),
});

export const measurementSchema = z.object({
  measuredOn: dateStr,
  heightCm: z.number().min(50).max(250).nullable().optional(),
  weightKg: z.number().min(2).max(400).nullable().optional(),
  targetWeightKg: z.number().min(2).max(400).nullable().optional(),
  ...Object.fromEntries(CIRCUMFERENCES.map(({ key }) => [key, z.number().min(5).max(300).nullable().optional()])) as Record<
    CircumferenceKey,
    z.ZodOptional<z.ZodNullable<z.ZodNumber>>
  >,
  note: z.string().trim().max(500).nullable().optional(),
});

// ───────────────────────── Takvim ayarları ─────────────────────────

export const availabilityRuleSchema = z
  .object({
    weekday: z.number().int().min(1).max(7),
    isWorking: z.boolean(),
    startTime: timeStr.nullable(),
    endTime: timeStr.nullable(),
    breakStart: timeStr.nullable(),
    breakEnd: timeStr.nullable(),
    slotMinutes: z.number().int().min(10).max(240),
    bufferMinutes: z.number().int().min(0).max(120),
  })
  .superRefine((r, ctx) => {
    if (!r.isWorking) return;
    if (!r.startTime || !r.endTime) {
      ctx.addIssue({ code: 'custom', path: ['startTime'], message: 'Çalışılan gün için başlangıç ve bitiş saati gerekli' });
      return;
    }
    if (r.startTime >= r.endTime) ctx.addIssue({ code: 'custom', path: ['endTime'], message: 'Bitiş, başlangıçtan sonra olmalı' });
    if ((r.breakStart && !r.breakEnd) || (!r.breakStart && r.breakEnd))
      ctx.addIssue({ code: 'custom', path: ['breakEnd'], message: 'Öğle arası için başlangıç ve bitiş birlikte girilmeli' });
    if (r.breakStart && r.breakEnd) {
      if (r.breakStart >= r.breakEnd) ctx.addIssue({ code: 'custom', path: ['breakEnd'], message: 'Ara bitişi, başlangıcından sonra olmalı' });
      if (r.breakStart < r.startTime || r.breakEnd > r.endTime)
        ctx.addIssue({ code: 'custom', path: ['breakStart'], message: 'Öğle arası çalışma saatleri içinde olmalı' });
    }
  });
export const availabilityRulesSchema = z.object({ rules: z.array(availabilityRuleSchema).length(7) });

export const blockedDateSchema = z
  .object({
    date: dateStr,
    /** Birden fazla gün için bitiş tarihi (dahil) */
    endDate: dateStr.optional().nullable(),
    kind: z.enum(BLOCKED_DATE_KINDS),
    reason: z.enum(BLOCKED_DATE_REASONS),
    label: z.string().trim().max(120).optional().nullable(),
    startTime: timeStr.optional().nullable(),
    endTime: timeStr.optional().nullable(),
  })
  .superRefine((b, ctx) => {
    if (b.kind !== 'FULL_DAY') {
      if (!b.startTime || !b.endTime) ctx.addIssue({ code: 'custom', path: ['startTime'], message: 'Saat aralığı gerekli' });
      else if (b.startTime >= b.endTime) ctx.addIssue({ code: 'custom', path: ['endTime'], message: 'Bitiş, başlangıçtan sonra olmalı' });
    }
    if (b.endDate && b.endDate < b.date) ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'Bitiş tarihi başlangıçtan önce olamaz' });
  });

// ───────────────────────── Hizmetler ─────────────────────────

export const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Yalnızca küçük harf, rakam ve tire kullanın');

export const serviceSchema = z.object({
  title: z.string().trim().min(2).max(120),
  slug: slugSchema.optional(),
  summary: z.string().trim().min(2).max(300),
  description: z.string().trim().max(4000).default(''),
  icon: z.enum(SERVICE_ICONS).default('leaf'),
  imageUrl: z.string().trim().max(500).nullable().optional(),
  isPublished: z.boolean().default(true),
  durationMinutes: z.number().int().min(10).max(240).nullable().optional(),
  priceCents: z.number().int().min(0).max(100_000_000).nullable().optional(),
  showPrice: z.boolean().default(false),
});
export const serviceReorderSchema = z.object({ ids: z.array(z.string().max(40)).min(1).max(100) });

// ───────────────────────── Blog & SSS ─────────────────────────

export const blogPostSchema = z.object({
  title: z.string().trim().min(3).max(160),
  slug: slugSchema.optional(),
  excerpt: z.string().trim().max(400).default(''),
  content: z.string().max(60000).default(''),
  coverImageUrl: z.string().trim().max(500).nullable().optional(),
  coverImageAlt: z.string().trim().max(200).nullable().optional(),
  categoryId: z.string().max(40).nullable().optional(),
  seoTitle: z.string().trim().max(70).nullable().optional(),
  metaDescription: z.string().trim().max(170).nullable().optional(),
  expertReviewed: z.boolean().default(false),
});
export const blogStatusSchema = z.object({ status: z.enum(POST_STATUSES) });

export const faqSchema = z.object({
  question: z.string().trim().min(3).max(300),
  answer: z.string().trim().min(1).max(3000),
  isPublished: z.boolean().default(false),
});

// ───────────────────────── Profil ─────────────────────────

export const profileSchema = z.object({
  firstName: personName,
  lastName: personName,
  salutation: z.string().trim().max(60).nullable().optional(),
  email: emailSchema,
});

export const notificationPrefsSchema = z.object({
  inApp: z.record(z.string(), z.boolean()),
  email: z.record(z.string(), z.boolean()),
});

export const reportQuerySchema = z.object({ from: dateStr, to: dateStr });

// ───────────────────────── Grup dersleri (Pilates) ─────────────────────────

const capacity = z.coerce.number().int().min(1, 'En az 1 kişi').max(CLASS_CAPACITY_MAX, `En fazla ${CLASS_CAPACITY_MAX} kişi`);
const classDuration = z.coerce.number().int().min(15, 'En az 15 dakika').max(240, 'En fazla 240 dakika');
const classTitle = z.string().trim().min(2, 'En az 2 karakter girin').max(80, 'En fazla 80 karakter');
const optionalNote = z.string().trim().max(1000, 'En fazla 1000 karakter').optional().nullable().transform((v) => (v ? v : null));
const idList = z.array(z.string().min(1).max(40)).max(CLASS_CAPACITY_MAX * 4);

export const classGroupCreateSchema = z.object({
  name: classTitle,
  capacity: capacity.default(CLASS_CAPACITY_DEFAULT),
  defaultDurationMinutes: classDuration.default(50),
  note: optionalNote,
  memberIds: idList.default([]),
});
export const classGroupUpdateSchema = z.object({
  name: classTitle.optional(),
  capacity: capacity.optional(),
  defaultDurationMinutes: classDuration.optional(),
  note: optionalNote,
  isActive: z.boolean().optional(),
});
export const classGroupNoteSchema = z.object({
  kind: z.enum(['DONE', 'PLANNED']),
  body: z.string().trim().min(1, 'Not boş olamaz').max(4000, 'Not en fazla 4000 karakter olabilir'),
  noteDate: dateStr.optional().nullable(),
});
export const classGroupNoteUpdateSchema = classGroupNoteSchema.partial();
export const classGroupMembersSchema = z.object({
  memberIds: idList,
  /** true: gelecekteki planlı derslerin katılımcı listesi de güncellenir */
  syncUpcoming: z.boolean().default(true),
});

export const classSessionCreateSchema = z
  .object({
    groupId: z.string().max(40).optional().nullable(),
    title: classTitle.optional().nullable(),
    date: dateStr,
    time: timeStr,
    durationMinutes: classDuration.optional(),
    capacity: capacity.optional(),
    /** Grupsuz (tek seferlik) derste katılımcılar */
    clientIds: idList.optional(),
    note: optionalNote,
    allowOutsideHours: z.boolean().default(false),
  })
  .refine((v) => v.groupId || v.title, { path: ['title'], message: 'Grup seçin veya ders adı girin' });

export const classRecurringSchema = z.object({
  /** Haftalık tekrar: her gün için saat (ör. Salı 18:00, Perşembe 19:00) */
  slots: z
    .array(z.object({ weekday: z.number().int().min(1).max(7), time: timeStr }))
    .min(1, 'En az bir gün seçin')
    .max(14),
  startDate: dateStr,
  weeks: z.coerce.number().int().min(1, 'En az 1 hafta').max(26, 'En fazla 26 hafta'),
  durationMinutes: classDuration.optional(),
  allowOutsideHours: z.boolean().default(false),
});

export const classSessionUpdateSchema = z.object({
  title: classTitle.optional(),
  date: dateStr.optional(),
  time: timeStr.optional(),
  durationMinutes: classDuration.optional(),
  capacity: capacity.optional(),
  note: optionalNote,
  allowOutsideHours: z.boolean().default(false),
});

export const classSessionStatusSchema = z.object({
  status: z.enum(CLASS_SESSION_STATUSES),
});

export const classAttendeeAddSchema = z.object({ clientId: z.string().min(1).max(40) });
export const classAttendanceUpdateSchema = z.object({ status: z.enum(CLASS_ATTENDANCE_STATUSES) });

export const classSessionListQuerySchema = z
  .object({
    from: dateStr,
    to: dateStr,
    groupId: z.string().max(40).optional(),
    clientId: z.string().max(40).optional(),
    includeCancelled: z.enum(['0', '1']).optional(),
  })
  .refine((v) => v.from <= v.to, 'Geçersiz aralık');
