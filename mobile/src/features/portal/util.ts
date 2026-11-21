// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Hesabım (danışan) ekranlarının küçük yardımcıları — web'deki src/views/portal/* ile aynı kurallar */
import { router } from 'expo-router';
import type { QueryKey } from '@tanstack/react-query';
import { recipeImageUrl } from '@shared/recipe';
import type { AppointmentStatus, ClassAttendanceStatus } from '@shared/constants';
import type { Tone } from '@/theme';
import { API_URL } from '@/lib/config';

/** Sorgu anahtarları (ilk öğe kaynak adı) */
export const PK = {
  overview: ['portal', 'overview'] as QueryKey,
  plans: ['portal', 'plans'] as QueryKey,
  plan: (id: string) => ['portal', 'plans', id] as QueryKey,
  recipes: ['portal', 'recipes'] as QueryKey,
  recipe: (id: string) => ['portal', 'recipes', id] as QueryKey,
  appointments: ['portal', 'appointments'] as QueryKey,
  requests: ['portal', 'requests'] as QueryKey,
  pilates: ['portal', 'pilates'] as QueryKey,
  pilatesAvailability: ['portal', 'pilates', 'availability'] as QueryKey,
  consultDays: (from: string) => ['portal', 'consult-days', from] as QueryKey,
  measurements: ['portal', 'measurements'] as QueryKey,
  messages: ['portal', 'messages'] as QueryKey,
  files: ['portal', 'files'] as QueryKey,
};

const n1 = (v: number) => v.toLocaleString('tr-TR', { maximumFractionDigits: 1 });
export const kg = (v: number) => `${n1(v)} kg`;
/** null → "—" */
export const num = (v: number | null | undefined, unit: string) => (v == null ? '—' : `${n1(v)} ${unit}`);
export const fileSize = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} MB`);

/** Tarif görselinin tam adresi (sunucu: /uploads/public/recipes/<id>-480|960.webp) */
export function recipeImage(base: string, size: 480 | 960 = 960) {
  const u = recipeImageUrl(base, size);
  return /^https?:/i.test(u) ? u : API_URL + u;
}

/** Uygulama içi randevu talebi (web: /randevu, /randevu?tur=pilates) — src/app/hesabim/randevu-al.tsx */
export function openBooking(kind?: 'pilates') {
  router.push(kind ? { pathname: '/hesabim/randevu-al', params: { tur: 'pilates' } } : '/hesabim/randevu-al');
}

export const APPOINTMENT_TONE: Partial<Record<AppointmentStatus, Tone>> = {
  CONFIRMED: 'success',
  PENDING: 'warning',
  COMPLETED: 'neutral',
  CANCELLED: 'danger',
  NO_SHOW: 'danger',
};

export const CLASS_TONE: Partial<Record<ClassAttendanceStatus, Tone>> = {
  BOOKED: 'success',
  ATTENDED: 'neutral',
  NO_SHOW: 'danger',
  EXCUSED: 'warning',
};
