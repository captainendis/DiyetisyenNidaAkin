// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Çalışma takvimi tipleri (sunucu: server/routes/availability.ts) */
import type { BlockedDateKind, BlockedDateReason } from '@shared/constants';
import { minutesOf } from '@shared/time';

export interface Rule {
  weekday: number;
  isWorking: boolean;
  startTime: string | null;
  endTime: string | null;
  breakStart: string | null;
  breakEnd: string | null;
  slotMinutes: number;
  bufferMinutes: number;
}

export interface BlockedDate {
  id: string;
  date: string;
  kind: BlockedDateKind;
  reason: BlockedDateReason;
  label: string | null;
  startTime: string | null;
  endTime: string | null;
}

export interface AffectedAppointment {
  appointmentId: string;
  date: string;
  time: string;
  contactName: string;
}

export const cleanRule = ({ weekday, isWorking, startTime, endTime, breakStart, breakEnd, slotMinutes, bufferMinutes }: Rule): Rule => ({
  weekday,
  isWorking,
  startTime,
  endTime,
  breakStart,
  breakEnd,
  slotMinutes,
  bufferMinutes,
});

/** Sunucudaki slot algoritmasıyla aynı hesap: günde kaç randevu sığar */
export function slotsPerDay(r: Rule): number {
  if (!r.isWorking || !r.startTime || !r.endTime || r.startTime >= r.endTime || r.slotMinutes < 10) return 0;
  let windows = [{ s: minutesOf(r.startTime), e: minutesOf(r.endTime) }];
  if (r.breakStart && r.breakEnd && r.breakStart < r.breakEnd) {
    const bs = minutesOf(r.breakStart);
    const be = minutesOf(r.breakEnd);
    windows = windows.flatMap((w) => {
      if (be <= w.s || bs >= w.e) return [w];
      const out: { s: number; e: number }[] = [];
      if (bs > w.s) out.push({ s: w.s, e: bs });
      if (be < w.e) out.push({ s: be, e: w.e });
      return out;
    });
  }
  const step = r.slotMinutes + r.bufferMinutes;
  let n = 0;
  for (const w of windows) for (let t = w.s; t + r.slotMinutes <= w.e; t += step) n++;
  return n;
}
