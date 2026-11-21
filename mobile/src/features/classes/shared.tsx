// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Pilates (grup dersi) ekranlarının ortak parçaları: durum rozetleri, doluluk göstergesi, gün/saat yardımcıları */
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Badge, T } from '@/components/ui';
import { colors, fonts, type Tone } from '@/theme';
import {
  CLASS_ATTENDANCE_LABEL,
  CLASS_SESSION_STATUS_LABEL,
  WEEKDAY_LABEL,
  type ClassAttendanceStatus,
  type ClassSessionStatus,
} from '@shared/constants';
import { minutesOf, timeOf } from '@shared/time';

export type { ClassClientRef, ClassGroupDTO, ClassSessionDTO, ClassRecurringResult, ClassMemberSyncResult, ClassGroupNoteDTO } from '@shared/classes';

/** Sorgu anahtarları — tüm pilates verisi ['classes', …] altında; mutasyonlar ['classes'] önekini tazeler */
export const classKeys = {
  all: ['classes'] as const,
  groups: ['classes', 'groups'] as const,
  sessions: (from: string, to: string, extra: Record<string, string> = {}) => ['classes', 'sessions', from, to, extra] as const,
  session: (id: string) => ['classes', 'session', id] as const,
  notes: (groupId: string) => ['classes', 'notes', groupId] as const,
};

export const clientName = (c: { firstName: string; lastName: string }) => `${c.firstName} ${c.lastName}`.trim();

export const SESSION_TONE: Record<ClassSessionStatus, Tone> = { SCHEDULED: 'info', COMPLETED: 'success', CANCELLED: 'danger' };
export const ATTENDANCE_TONE: Record<ClassAttendanceStatus, Tone> = { BOOKED: 'neutral', ATTENDED: 'success', NO_SHOW: 'danger', EXCUSED: 'warning' };

export function SessionStatusBadge({ status }: { status: ClassSessionStatus }) {
  return <Badge label={CLASS_SESSION_STATUS_LABEL[status]} tone={SESSION_TONE[status]} />;
}
export function AttendanceBadge({ status }: { status: ClassAttendanceStatus }) {
  return <Badge label={CLASS_ATTENDANCE_LABEL[status]} tone={ATTENDANCE_TONE[status]} />;
}

/** "Salı 18:00 · Perşembe 19:00" */
export function patternLabel(pattern: { weekday: number; time: string }[]) {
  return pattern.map((p) => `${WEEKDAY_LABEL[p.weekday]} ${p.time}`).join(' · ');
}

/** "18:00–18:50" */
export const timeRange = (time: string, duration: number) => `${time}–${timeOf(minutesOf(time) + duration)}`;

/** Kontenjan noktaları: dolu / boş */
export function SeatDots({ taken, capacity }: { taken: number; capacity: number }) {
  const full = taken >= capacity;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }} accessible accessibilityLabel={`${taken} / ${capacity} kişi`}>
      <View style={{ flexDirection: 'row', gap: 3 }}>
        {Array.from({ length: Math.min(capacity, 12) }).map((_, i) => (
          <View key={i} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: i < taken ? (full ? colors.cocoa : colors.success) : colors.line }} />
        ))}
      </View>
      <T style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.cocoa }}>{taken}/{capacity}</T>
    </View>
  );
}

/** Sayı alanı için güvenli dönüşüm */
export const toInt = (v: string) => (v.trim() === '' ? NaN : Number(v.replace(/\D/g, '')));

/** Gecikmeli değer (arama kutuları) */
export function useDebounced<V>(value: V, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
