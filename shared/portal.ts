// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Danışan hesabı ("Hesabım") — sunucu ve istemcinin ortak kullandığı şemalar ve veri tipleri.
 * Danışan yalnızca kendi kaydına bağlı verileri görür; klinik görüşme notları bu tiplerde YOKTUR.
 */
import { z } from 'zod';
import { emailSchema, passwordPolicy } from './schemas';
import type { AppointmentStatus, MeetingType } from './constants';
import type { NutritionPlanData } from './plan';
import type { DietTag, RecipeCategory } from './recipe';

/** Etkinleştirme bağlantısının geçerlilik süresi (WhatsApp/SMS ile iletileceği için birkaç gün) */
export const ACTIVATION_TTL_HOURS = 72;
/** Şifre sıfırlama bağlantısının geçerlilik süresi */
export const RESET_TTL_MINUTES = 60;

// ───────────────────────── Panel (personel) ─────────────────────────

export const accountCreateSchema = z.object({ email: emailSchema });
export const accountUpdateSchema = z.object({ email: emailSchema.optional(), isActive: z.boolean().optional() });
export const clientMessageSchema = z.object({
  content: z.string().trim().min(1, 'Mesaj boş olamaz').max(5000, 'Mesaj en fazla 5000 karakter olabilir'),
  appointmentId: z.string().max(40).nullable().optional(),
});
export const fileVisibilitySchema = z.object({ visibleToClient: z.boolean() });

export interface PortalAccountInfo {
  id: string;
  email: string;
  isActive: boolean;
  /** Danışan şifresini belirledi mi */
  activated: boolean;
  activatedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  /** Kullanılmamış, süresi dolmamış bir etkinleştirme bağlantısı var mı (bağlantının kendisi tekrar gösterilmez) */
  pendingActivationUntil: string | null;
}

export interface PortalLinkResult {
  link: string;
  expiresAt: string;
  purpose: 'ACTIVATE' | 'RESET';
  /** Bağlantı e-postayla da gönderildi mi (SMTP yapılandırılmışsa) */
  emailed: boolean;
}

export interface StaffClientMessage {
  id: string;
  content: string;
  appointmentId: string | null;
  appointmentAt: string | null;
  author: { firstName: string; lastName: string } | null;
  createdAt: string;
  updatedAt: string;
}

// ───────────────────────── Danışan tarafı ─────────────────────────

export const portalLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Şifrenizi girin').max(200),
  remember: z.boolean().optional().default(false),
});
export const portalSetPasswordSchema = z.object({ token: z.string().min(20).max(200), password: passwordPolicy });
export const portalTokenQuerySchema = z.object({ token: z.string().min(20).max(200) });
export const portalForgotSchema = z.object({ email: emailSchema });
export const portalChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Mevcut şifrenizi girin'),
  newPassword: passwordPolicy,
});

export interface PortalMe {
  firstName: string;
  lastName: string;
  email: string;
  csrfToken: string;
}

export interface PortalAppointment {
  id: string;
  startsAt: string | null;
  endsAt: string | null;
  status: AppointmentStatus;
  meetingType: MeetingType;
  service: string | null;
}

export interface PortalPlanListItem {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface PortalPlanRecipeRef {
  id: string;
  title: string;
  label: string;
}

export interface PortalPlan extends PortalPlanListItem {
  data: Omit<NutritionPlanData, 'recipes'>;
  recipes: PortalPlanRecipeRef[];
}

export interface PortalRecipeCard {
  id: string;
  title: string;
  category: RecipeCategory;
  summary: string;
  dietTags: DietTag[];
  imageBase: string | null;
  /** Danışana özel varyasyon mu */
  personal: boolean;
  variantNote: string;
  /** Hangi planlarda geçiyor (plan adı) */
  inPlans: string[];
}

export interface PortalRecipe extends PortalRecipeCard {
  servings: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  kcal: number | null;
  ingredients: string[];
  steps: string[];
  tip: string;
}

/** Danışana gösterilen ölçüm — diyetisyenin ölçüm notu (klinik olabilir) gösterilmez */
export interface PortalMeasurement {
  id: string;
  measuredOn: string;
  heightCm: number | null;
  weightKg: number | null;
  targetWeightKg: number | null;
}

export interface PortalMessage {
  id: string;
  content: string;
  appointmentAt: string | null;
  author: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PortalFile {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface PortalOverview {
  nextAppointment: PortalAppointment | null;
  latestPlan: PortalPlanListItem | null;
  latestMessage: PortalMessage | null;
  weight: { current: number | null; first: number | null; target: number | null; measuredOn: string | null };
  counts: { plans: number; recipes: number; messages: number; files: number };
}
