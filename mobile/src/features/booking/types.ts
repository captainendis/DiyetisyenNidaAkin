// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Uygulama içi randevu talebi (web: src/components/forms/BookingForm.tsx) — herkese açık uçların yanıt tipleri.
 * Sunucu: server/routes/public-appointments.ts, server/routes/public-content.ts (/public/site)
 */
import type { QueryKey } from '@tanstack/react-query';
import type { ServiceIconKey } from '@shared/constants';
import type { Settings } from '@shared/settings';

export interface DaysRes {
  days: { date: string; available: number }[];
  leadTimeHours: number;
  maxDaysAhead: number;
}
export interface SlotsRes {
  date: string;
  closedReason: string | null;
  slots: { time: string; endTime: string; available: boolean }[];
}
export interface SubmitRes {
  ok: true;
  status: 'PENDING' | 'NEW_REQUEST';
  reference: string;
  whatsapp: string | null;
}

/** /public/site yanıtının randevu formunda kullanılan kısmı */
export interface BookingSite {
  settings: Pick<Settings, 'appointment' | 'contact'>;
  services: { id: string; slug: string; title: string; icon: ServiceIconKey | string }[];
}

export type Step = 1 | 2 | 3 | 4;

/** Sorgu anahtarları — 'public' önekiyle (danışan oturumundan bağımsız) */
export const BK = {
  site: ['public', 'site'] as QueryKey,
  availability: ['public', 'availability'] as QueryKey,
  days: (from: string, to: string, serviceId: string | null) => ['public', 'availability', 'days', from, to, serviceId] as QueryKey,
  slots: (date: string, serviceId: string | null) => ['public', 'availability', 'slots', date, serviceId] as QueryKey,
};
