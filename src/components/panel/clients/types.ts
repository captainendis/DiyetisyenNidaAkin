// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import type { AppointmentStatus, ClientStatus, MeetingType } from '@shared/constants';

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

export interface Client {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  birthDate: string | null;
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

export interface Measurement {
  id: string;
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
  uploadedBy: { firstName: string; lastName: string } | null;
}

export const CLIENT_STATUS_TONE = { ACTIVE: 'success', PASSIVE: 'neutral', ARCHIVED: 'dark' } as const;
