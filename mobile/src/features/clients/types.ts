// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Danışan ekranlarının tipleri — web'deki src/components/panel/clients/types.ts ile aynı (sunucu: server/routes/clients.ts) */
import type { AppointmentStatus, ClassAttendanceStatus, ClassSessionStatus, ClientSex, ClientStatus, MeetingType } from '@shared/constants';
import type { Circumferences } from '@shared/measurements';
import type { Tone } from '@/theme';

export interface ClientListItem {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  status: ClientStatus;
  source: 'WEBSITE' | 'PANEL';
  createdAt: string;
  firstVisitDate: string | null;
  lastVisitAt: string | null;
  totalVisits: number;
  nextAppointmentAt: string | null;
}

export interface ClientListResponse {
  items: ClientListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Client {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  birthDate: string | null;
  sex: ClientSex | null;
  firstVisitDate: string | null;
  preferredMeetingType: MeetingType | null;
  status: ClientStatus;
  source: 'WEBSITE' | 'PANEL';
  internalNote: string | null;
  kvkkNoticeAt: string | null;
  healthConsentAt: string | null;
  healthConsentNote: string | null;
  healthConsentWithdrawnAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClientStats {
  totalVisits: number;
  lastVisitAt: string | null;
  nextAppointment: { id: string; startsAt: string; status: AppointmentStatus } | null;
  firstAppointmentAt: string | null;
}

export interface ClientDetail {
  client: Client;
  stats: ClientStats;
}

export interface ClientAppointment {
  id: string;
  status: AppointmentStatus;
  startsAt: string | null;
  endsAt: string | null;
  meetingType: MeetingType;
  source: 'WEBSITE' | 'PANEL';
  createdAt: string;
  service: { id: string; title: string } | null;
}

export interface ConsultationNote {
  id: string;
  content: string;
  appointmentId: string | null;
  author: { firstName: string; lastName: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface Measurement extends Circumferences {
  id: string;
  bodyFatPct: number | null;
  muscleKg: number | null;
  measuredOn: string;
  heightCm: number | null;
  weightKg: number | null;
  targetWeightKg: number | null;
  note: string | null;
  bmi: number | null;
  createdAt: string;
}

export interface ClientFile {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  visibleToClient: boolean;
  uploadedBy: { firstName: string; lastName: string } | null;
}

export interface PlanListItem {
  id: string;
  name: string;
  isTemplate: boolean;
  clientId: string | null;
  createdAt: string;
  updatedAt: string;
}

export const CLIENT_STATUS_TONE: Record<ClientStatus, Tone> = { ACTIVE: 'success', PASSIVE: 'neutral', ARCHIVED: 'info' };

export const APPOINTMENT_STATUS_TONE: Record<AppointmentStatus, Tone> = {
  NEW_REQUEST: 'rose',
  PENDING: 'warning',
  CONFIRMED: 'success',
  COMPLETED: 'gold',
  CANCELLED: 'danger',
  NO_SHOW: 'neutral',
};

export const SESSION_TONE: Record<ClassSessionStatus, Tone> = { SCHEDULED: 'info', COMPLETED: 'gold', CANCELLED: 'danger' };
export const ATTENDANCE_TONE: Record<ClassAttendanceStatus, Tone> = { BOOKED: 'neutral', ATTENDED: 'success', NO_SHOW: 'danger', EXCUSED: 'warning' };

/** Sorgu anahtarları */
export const clientKeys = {
  all: ['clients'] as const,
  list: (params: object) => ['clients', 'list', params] as const,
  detail: (id: string) => ['clients', id] as const,
  sub: (id: string, what: string) => ['clients', id, what] as const,
  plans: (id: string) => ['plans', 'client', id] as const,
};
