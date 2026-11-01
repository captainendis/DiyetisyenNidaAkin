// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import type { AppointmentStatus, MeetingType } from '@shared/constants';

export interface AppointmentDTO {
  id: string;
  status: AppointmentStatus;
  meetingType: MeetingType;
  source: 'WEBSITE' | 'PANEL';
  startsAt: string | null;
  endsAt: string | null;
  date: string | null;
  time: string | null;
  durationMinutes: number | null;
  contactName: string;
  contactPhone: string;
  contactEmail: string | null;
  clientMessage: string | null;
  internalNote: string | null;
  createdAt: string;
  explicitConsentAt: string | null;
  kvkkNoticeAcceptedAt: string | null;
  client: { id: string; firstName: string; lastName: string; phone: string; email: string | null } | null;
  service: { id: string; title: string } | null;
}

export interface StatusHistoryEntry {
  id: string;
  fromStatus: AppointmentStatus | null;
  toStatus: AppointmentStatus;
  note: string | null;
  previousStartsAt: string | null;
  newStartsAt: string | null;
  changedAt: string;
  changedBy: { firstName: string; lastName: string } | null;
}

export type AppointmentDetail = AppointmentDTO & { statusHistory: StatusHistoryEntry[] };

export interface DayPlanDTO {
  date: string;
  isWorking: boolean;
  closedReason: string | null;
  windows: { start: number; end: number }[];
  slotMinutes: number;
}

export interface SlotDTO { time: string; endTime: string; available: boolean }

export function displayName(a: Pick<AppointmentDTO, 'client' | 'contactName'>) {
  return a.client ? `${a.client.firstName} ${a.client.lastName}`.trim() : a.contactName;
}

/** Durum geçişleri — sunucudaki TRANSITIONS ile aynı */
export const TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  NEW_REQUEST: ['PENDING', 'CONFIRMED', 'CANCELLED'],
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['COMPLETED', 'CANCELLED', 'NO_SHOW', 'PENDING'],
  COMPLETED: ['CONFIRMED'],
  NO_SHOW: ['CONFIRMED', 'COMPLETED'],
  CANCELLED: ['CONFIRMED', 'PENDING'],
};

export const CHART_COLORS = { completed: '#2F8257', open: '#C8913F', cancelled: '#B85A5A' };
