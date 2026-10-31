import type { BlockedDateKind, BlockedDateReason } from '@shared/constants';

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

const m = (t: string) => {
  const [h, mm] = t.split(':').map(Number);
  return h * 60 + mm;
};

/** Sunucudaki slot algoritmasıyla aynı hesap: günde kaç randevu sığar */
export function slotsPerDay(r: Rule): number {
  if (!r.isWorking || !r.startTime || !r.endTime || r.startTime >= r.endTime || r.slotMinutes < 10) return 0;
  let windows = [{ s: m(r.startTime), e: m(r.endTime) }];
  if (r.breakStart && r.breakEnd && r.breakStart < r.breakEnd) {
    const bs = m(r.breakStart), be = m(r.breakEnd);
    windows = windows.flatMap((w) => {
      if (be <= w.s || bs >= w.e) return [w];
      const out = [];
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
