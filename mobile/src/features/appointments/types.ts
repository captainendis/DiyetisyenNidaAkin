// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Randevu API tipleri — web'deki src/components/panel/appointments/types.ts ile aynı (sunucu: services/appointments.ts → toDTO) */
import {
  MEETING_TYPE_LABEL,
  PILATES_FORMAT_LABEL,
  type AppointmentKind,
  type AppointmentStatus,
  type Daypart,
  type MeetingType,
  type PilatesFormat,
} from '@shared/constants';
import type { QueryKey } from '@tanstack/react-query';
import type { Tone } from '@/theme';

export interface AppointmentDTO {
  id: string;
  status: AppointmentStatus;
  meetingType: MeetingType;
  kind: AppointmentKind;
  pilatesFormat: PilatesFormat | null;
  preferredDays: number[];
  preferredDayparts: Daypart[];
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

export interface SlotDTO {
  time: string;
  endTime: string;
  available: boolean;
}

export interface AppointmentPage {
  items: AppointmentDTO[];
  total: number;
  page: number;
  pageSize: number;
}

export function displayName(a: Pick<AppointmentDTO, 'client' | 'contactName'>) {
  return a.client ? `${a.client.firstName} ${a.client.lastName}`.trim() : a.contactName;
}

/** Görüşme türü: pilates talebinde ders türü gösterilir */
export const appointmentTypeLabel = (a: Pick<AppointmentDTO, 'kind' | 'pilatesFormat' | 'meetingType'>) =>
  a.kind === 'PILATES' ? `Pilates${a.pilatesFormat ? ` · ${PILATES_FORMAT_LABEL[a.pilatesFormat]}` : ''}` : MEETING_TYPE_LABEL[a.meetingType];

/** Durum geçişleri — sunucudaki TRANSITIONS ile aynı */
export const TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  NEW_REQUEST: ['PENDING', 'CONFIRMED', 'CANCELLED'],
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['COMPLETED', 'CANCELLED', 'NO_SHOW', 'PENDING'],
  COMPLETED: ['CONFIRMED'],
  NO_SHOW: ['CONFIRMED', 'COMPLETED'],
  CANCELLED: ['CONFIRMED', 'PENDING'],
};

export const STATUS_TONE: Record<AppointmentStatus, Tone> = {
  NEW_REQUEST: 'rose',
  PENDING: 'warning',
  CONFIRMED: 'success',
  COMPLETED: 'info',
  CANCELLED: 'neutral',
  NO_SHOW: 'danger',
};

/** Randevu verisi değişince tazelenecek sorgular (takvim, talepler, genel bakış, bildirim rozeti) */
export const APPOINTMENT_INVALIDATE: QueryKey[] = [['appointments'], ['dashboard'], ['notifications']];
