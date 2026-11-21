// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** GET /api/reports yanıtı (server/routes/reports.ts) */
import { DateTime } from 'luxon';
import { TIME_ZONE } from '@shared/constants';

export interface ReportBucket {
  key: string;
  label: string;
  start: string;
  total: number;
  completed: number;
  cancelled: number;
  noShow: number;
  pending: number;
  confirmed: number;
}

export interface ReportData {
  range: { from: string; to: string; days: number };
  totals: {
    appointments: number;
    completed: number;
    cancelled: number;
    noShow: number;
    pending: number;
    confirmed: number;
    untimedRequests: number;
    newClients: number;
    returningClients: number;
  };
  daily: ReportBucket[];
  weekly: ReportBucket[];
  monthly: ReportBucket[];
  byMeetingType: { IN_PERSON: number; ONLINE: number };
  bySource: { WEBSITE: number; PANEL: number };
}

export type Preset = 'week' | 'month' | 'last30' | 'last90' | 'year' | 'custom';
export type Grain = 'daily' | 'weekly' | 'monthly';

export const PRESETS: { value: Exclude<Preset, 'custom'>; label: string }[] = [
  { value: 'week', label: 'Bu hafta' },
  { value: 'month', label: 'Bu ay' },
  { value: 'last30', label: 'Son 30 gün' },
  { value: 'last90', label: 'Son 3 ay' },
  { value: 'year', label: 'Bu yıl' },
];

export const GRAINS: { value: Grain; label: string }[] = [
  { value: 'daily', label: 'Gün' },
  { value: 'weekly', label: 'Hafta' },
  { value: 'monthly', label: 'Ay' },
];

export function presetRange(p: Exclude<Preset, 'custom'>) {
  const now = DateTime.now().setZone(TIME_ZONE);
  const iso = (d: DateTime) => d.toISODate()!;
  switch (p) {
    case 'week':
      return { from: iso(now.startOf('week')), to: iso(now.endOf('week')) };
    case 'month':
      return { from: iso(now.startOf('month')), to: iso(now.endOf('month')) };
    case 'last30':
      return { from: iso(now.minus({ days: 29 })), to: iso(now) };
    case 'last90':
      return { from: iso(now.minus({ months: 3 }).plus({ days: 1 })), to: iso(now) };
    case 'year':
      return { from: iso(now.startOf('year')), to: iso(now.endOf('year')) };
  }
}
