// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Pilates (grup dersi) ekranlarının ortak parçaları: çoklu danışan seçici, doluluk göstergesi, durum rozetleri */
import { useState } from 'react';
import { X } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi, useDebounced } from '@/hooks/useApi';
import { cn, formatPhone } from '@/lib/format';
import {
  CLASS_ATTENDANCE_LABEL,
  CLASS_SESSION_STATUS_LABEL,
  WEEKDAY_LABEL,
  type ClassAttendanceStatus,
  type ClassSessionStatus,
} from '@shared/constants';
import type { ClassClientRef } from '@shared/classes';
import { Badge, Field, type BadgeTone } from '@/components/panel/ui';

export type { ClassClientRef, ClassGroupDTO, ClassSessionDTO, ClassRecurringResult, ClassMemberSyncResult, ClientClassSummary } from '@shared/classes';

export const clientName = (c: { firstName: string; lastName: string }) => `${c.firstName} ${c.lastName}`.trim();

export const SESSION_TONE: Record<ClassSessionStatus, BadgeTone> = { SCHEDULED: 'info', COMPLETED: 'dark', CANCELLED: 'danger' };
export const ATTENDANCE_TONE: Record<ClassAttendanceStatus, BadgeTone> = { BOOKED: 'neutral', ATTENDED: 'success', NO_SHOW: 'danger', EXCUSED: 'warning' };

export function SessionStatusBadge({ status }: { status: ClassSessionStatus }) {
  return <Badge tone={SESSION_TONE[status]}>{CLASS_SESSION_STATUS_LABEL[status]}</Badge>;
}
export function AttendanceBadge({ status }: { status: ClassAttendanceStatus }) {
  return <Badge tone={ATTENDANCE_TONE[status]}>{CLASS_ATTENDANCE_LABEL[status]}</Badge>;
}

/** "Salı 18:00 · Perşembe 19:00" */
export function patternLabel(pattern: { weekday: number; time: string }[]) {
  return pattern.map((p) => `${WEEKDAY_LABEL[p.weekday]} ${p.time}`).join(' · ');
}

/** Kontenjan noktaları: dolu / boş */
export function SeatDots({ taken, capacity, className }: { taken: number; capacity: number; className?: string }) {
  const full = taken >= capacity;
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)} aria-label={`${taken} / ${capacity} kişi`}>
      <span className="inline-flex gap-0.5" aria-hidden>
        {Array.from({ length: Math.min(capacity, 12) }).map((_, i) => (
          <span key={i} className={cn('h-2 w-2 rounded-full', i < taken ? (full ? 'bg-cocoa' : 'bg-success') : 'bg-panel-line')} />
        ))}
      </span>
      <span className="tabular text-[0.75rem] font-semibold text-cocoa">{taken}/{capacity}</span>
    </span>
  );
}

/** Birden çok danışan seçimi (arama + çipler), en fazla `max` kişi */
export function MultiClientPicker({
  value, onChange, max, label = 'Üyeler', hint, error, exclude = [], hideCount = false,
}: {
  value: ClassClientRef[];
  onChange: (v: ClassClientRef[]) => void;
  max: number;
  label?: string;
  hint?: string;
  error?: string;
  exclude?: string[];
  hideCount?: boolean;
}) {
  const [q, setQ] = useState('');
  const dq = useDebounced(q.trim(), 250);
  const full = value.length >= max;
  const hits = useApi(
    () => (dq.length >= 2 && !full ? api.get<{ items: ClassClientRef[] }>('/clients', { q: dq, pageSize: 8 }) : Promise.resolve({ items: [] as ClassClientRef[] })),
    [dq, full],
  );
  const taken = new Set([...value.map((v) => v.id), ...exclude]);
  const results = (hits.data?.items ?? []).filter((c) => !taken.has(c.id));

  return (
    <Field label={hideCount ? label : <>{label} <span className="tabular font-normal text-panel-muted">({value.length}/{max})</span></>} hint={hint} error={error}>
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((c) => (
            <li key={c.id} className="inline-flex items-center gap-1 rounded-full bg-panel-bg py-1 pr-1 pl-3 text-[0.82rem] font-semibold text-espresso ring-1 ring-panel-line">
              {clientName(c)}
              <button type="button" onClick={() => onChange(value.filter((v) => v.id !== c.id))} aria-label={`${clientName(c)} kişisini çıkar`} className="rounded-full p-0.5 text-panel-muted hover:bg-white hover:text-espresso">
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {full ? (
        <p className="text-[0.8rem] text-panel-muted">Kontenjan doldu. Başka kişi eklemek için kontenjanı artırın.</p>
      ) : (
        <>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Danışan ara: ad, soyad veya telefon"
            aria-label="Danışan ara"
            className="h-10 w-full rounded-lg border border-panel-line bg-white px-3 text-sm text-espresso placeholder:text-panel-muted focus:border-cocoa focus:ring-2 focus:ring-cocoa/10 focus:outline-none"
          />
          {results.length > 0 && (
            <ul className="max-h-48 divide-y divide-panel-line overflow-y-auto rounded-lg border border-panel-line">
              {results.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange([...value, { id: c.id, firstName: c.firstName, lastName: c.lastName, phone: c.phone }]);
                      setQ('');
                    }}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-panel-bg"
                  >
                    <span className="font-medium text-espresso">{clientName(c)}</span>
                    <span className="tabular text-[0.78rem] text-panel-muted">{formatPhone(c.phone)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {dq.length >= 2 && !hits.loading && !results.length && <p className="text-[0.8rem] text-panel-muted">Eşleşen danışan yok. Yeni kişiyi önce “Danışanlar” bölümünden ekleyin.</p>}
        </>
      )}
    </Field>
  );
}
