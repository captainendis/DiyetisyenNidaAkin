// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Genel bakış API tipleri (sunucu: server/routes/dashboard.ts) */
import type { AppointmentDTO } from '@/features/appointments/types';

export interface StatCardData {
  value: number;
  comparison: { value: number; current?: number; label: string };
  series: { date: string; value: number }[];
}
export interface DashboardStats {
  generatedAt: string;
  seriesLabel: string;
  cards: { today: StatCardData; pending: StatCardData; clients: StatCardData; month: StatCardData };
}
export interface Agenda {
  date: string;
  items: AppointmentDTO[];
  pendingRequests: AppointmentDTO[];
  pendingTotal: number;
}
export interface Weekly {
  days: { date: string; completed: number; cancelled: number; open: number }[];
  definitions: { completed: string; cancelled: string; open: string };
}
export interface SetupItem {
  key: string;
  group: string;
  label: string;
  hint?: string;
  done: boolean;
  href: string;
}

/** Grafik renkleri — web'deki CHART_COLORS ile aynı */
export const CHART_COLORS = { completed: '#2F8257', open: '#C8913F', cancelled: '#B85A5A' };
