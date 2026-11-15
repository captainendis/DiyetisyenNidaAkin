// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Grup dersleri (Pilates) — API yanıt tipleri. Sunucu (server/services/classes.ts) ve panel aynı tipleri kullanır. */
import type { ClassAttendanceStatus, ClassSessionStatus } from './constants';

export interface ClassClientRef {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
}

export interface ClassAttendeeDTO {
  clientId: string;
  status: ClassAttendanceStatus;
  client: ClassClientRef;
  /** Grubun kalıcı üyesi mi (değilse telafi / misafir) */
  isMember: boolean;
}

export interface ClassSessionDTO {
  id: string;
  groupId: string | null;
  groupName: string | null;
  title: string;
  status: ClassSessionStatus;
  startsAt: string;
  endsAt: string;
  /** İstanbul saatine göre YYYY-MM-DD */
  date: string;
  /** HH:mm */
  time: string;
  durationMinutes: number;
  capacity: number;
  /** Yer tutan katılımcı sayısı (haber verenler hariç) */
  seatsTaken: number;
  note: string | null;
  attendees: ClassAttendeeDTO[];
}

export interface ClassGroupDTO {
  id: string;
  name: string;
  capacity: number;
  defaultDurationMinutes: number;
  note: string | null;
  isActive: boolean;
  members: ClassClientRef[];
  /** Önümüzdeki 4 haftadaki planlı derslerden çıkarılan düzen, ör. [{ weekday: 2, time: '18:00' }] */
  pattern: { weekday: number; time: string }[];
  nextSession: { id: string; startsAt: string } | null;
  upcomingCount: number;
  createdAt: string;
}

export interface ClassRecurringResult {
  created: number;
  skipped: { date: string; time: string; reason: string }[];
}

export interface ClassMemberSyncResult {
  /** Gelecek derslere eklenen katılım sayısı */
  added: number;
  /** Gelecek derslerden çıkarılan katılım sayısı */
  removed: number;
  /** Kontenjan dolu olduğu için yeni üyenin eklenemediği ders sayısı */
  full: number;
}

export interface ClientClassSummary {
  groups: { id: string; name: string; isActive: boolean }[];
  upcoming: (ClassSessionDTO & { myStatus: ClassAttendanceStatus })[];
  past: (ClassSessionDTO & { myStatus: ClassAttendanceStatus })[];
  stats: { attended: number; noShow: number; excused: number };
}

/** Danışan hesabında görünen ders — diğer katılımcıların bilgisi yer almaz */
export interface PortalClassSession {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  status: ClassSessionStatus;
  myStatus: ClassAttendanceStatus;
}

/** Grup not defteri kaydı (panel) */
export interface ClassGroupNoteDTO {
  id: string;
  kind: 'DONE' | 'PLANNED';
  noteDate: string | null;
  body: string;
  author: string | null;
  createdAt: string;
  updatedAt: string;
}
