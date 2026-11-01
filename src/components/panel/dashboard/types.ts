// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import type { AppointmentDTO } from '../appointments/types';

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
export interface Agenda { date: string; items: AppointmentDTO[]; pendingRequests: AppointmentDTO[]; pendingTotal: number }
export interface Weekly {
  days: { date: string; completed: number; cancelled: number; open: number }[];
  definitions: { completed: string; cancelled: string; open: string };
}
