// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Müsaitlik ve çakışma servisi
 * ─────────────────────────────
 *  - Haftalık çalışma kuralları (availability_rules) + tarihe özel istisnalar (blocked_dates)
 *    birleştirilerek bir günün "çalışma pencereleri" hesaplanır.
 *  - Boş zaman dilimleri, mevcut randevular (+ dinlenme süresi) çıkarılarak üretilir.
 *  - validateSlot(): randevu oluşturma/güncellemede tüm kuralları kontrol eder.
 *  - withAppointmentLock(): advisory lock ile transaction içinde çakışma kontrolü + yazma yapar.
 *    Veritabanındaki exclusion constraint son savunma hattıdır.
 *
 * Tüm saatler Europe/Istanbul'dadır. Dakika tabanlı aralıklar [başlangıç, bitiş) yarı açık aralıktır.
 */
import { DateTime } from 'luxon';
import { prisma, Prisma, type Tx } from '../lib/db';
import { conflict } from '../lib/http';
import {
  HARD_CONFLICT_STATUSES,
  SLOT_HOLDING_STATUSES,
  TIME_ZONE,
  type AppointmentStatus,
} from '../../shared/constants';
import { addDays, endOfDayExclusive, isoWeekday, minutesOf, startOfDay, timeOf, todayStr, zonedToDate, toDateStr } from '../../shared/time';

/** Tüm randevu yazma işlemleri bu anahtarla serileştirilir */

export interface Interval {
  start: number; // gün başından dakika
  end: number;
}

export interface DayPlan {
  date: string;
  isWorking: boolean;
  /** Kapalıysa nedeni (tatil etiketi vb.) */
  closedReason: string | null;
  windows: Interval[];
  slotMinutes: number;
  bufferMinutes: number;
}

type RuleRow = Awaited<ReturnType<typeof prisma.availabilityRule.findMany>>[number];
type BlockRow = Awaited<ReturnType<typeof prisma.blockedDate.findMany>>[number];

function subtract(windows: Interval[], cut: Interval): Interval[] {
  const out: Interval[] = [];
  for (const w of windows) {
    if (cut.end <= w.start || cut.start >= w.end) {
      out.push(w);
      continue;
    }
    if (cut.start > w.start) out.push({ start: w.start, end: cut.start });
    if (cut.end < w.end) out.push({ start: cut.end, end: w.end });
  }
  return out;
}

/** Saf fonksiyon: kural + istisnalar → gün planı (test edilebilir) */
export function buildDayPlan(date: string, rule: Pick<RuleRow, 'isWorking' | 'startTime' | 'endTime' | 'breakStart' | 'breakEnd' | 'slotMinutes' | 'bufferMinutes'> | null, blocks: Pick<BlockRow, 'kind' | 'label' | 'reason' | 'startTime' | 'endTime'>[]): DayPlan {
  const slotMinutes = rule?.slotMinutes ?? 45;
  const bufferMinutes = rule?.bufferMinutes ?? 0;
  const base: DayPlan = { date, isWorking: false, closedReason: null, windows: [], slotMinutes, bufferMinutes };

  const fullDay = blocks.find((b) => b.kind === 'FULL_DAY');
  if (fullDay) return { ...base, closedReason: fullDay.label || 'Kapalı' };

  const custom = blocks.find((b) => b.kind === 'CUSTOM_HOURS' && b.startTime && b.endTime);
  let windows: Interval[] = [];
  if (custom) {
    windows = [{ start: minutesOf(custom.startTime!), end: minutesOf(custom.endTime!) }];
  } else if (rule?.isWorking && rule.startTime && rule.endTime) {
    windows = [{ start: minutesOf(rule.startTime), end: minutesOf(rule.endTime) }];
  } else {
    return { ...base, closedReason: 'Çalışma günü değil' };
  }
  if (rule?.breakStart && rule.breakEnd) {
    windows = subtract(windows, { start: minutesOf(rule.breakStart), end: minutesOf(rule.breakEnd) });
  }
  for (const b of blocks.filter((x) => x.kind === 'TIME_RANGE' && x.startTime && x.endTime)) {
    windows = subtract(windows, { start: minutesOf(b.startTime!), end: minutesOf(b.endTime!) });
  }
  return { ...base, isWorking: windows.length > 0, windows, closedReason: windows.length ? null : 'Kapalı' };
}

export async function getDayPlans(from: string, to: string, db: Tx | typeof prisma = prisma): Promise<Map<string, DayPlan>> {
  const [rules, blocks] = await Promise.all([
    db.availabilityRule.findMany(),
    db.blockedDate.findMany({ where: { date: { gte: from, lte: to } } }),
  ]);
  const byWeekday = new Map(rules.map((r) => [r.weekday, r]));
  const plans = new Map<string, DayPlan>();
  for (let d = from; d <= to; d = addDays(d, 1)) {
    plans.set(d, buildDayPlan(d, byWeekday.get(isoWeekday(d)) ?? null, blocks.filter((b) => b.date === d)));
  }
  return plans;
}

export interface BusyInterval extends Interval {
  id: string;
  status: AppointmentStatus;
}

async function busyIntervals(date: string, statuses: AppointmentStatus[], db: Tx | typeof prisma, ignoreId?: string): Promise<BusyInterval[]> {
  const rows = await db.appointment.findMany({
    where: {
      status: { in: statuses },
      startsAt: { lt: endOfDayExclusive(date) },
      endsAt: { gt: startOfDay(date) },
      ...(ignoreId ? { id: { not: ignoreId } } : {}),
    },
    select: { id: true, startsAt: true, endsAt: true, status: true },
  });
  const dayStart = DateTime.fromISO(date, { zone: TIME_ZONE }).startOf('day');
  return rows.map((r) => ({
    id: r.id,
    status: r.status as AppointmentStatus,
    start: Math.round(DateTime.fromJSDate(r.startsAt!).diff(dayStart, 'minutes').minutes),
    end: Math.round(DateTime.fromJSDate(r.endsAt!).diff(dayStart, 'minutes').minutes),
  }));
}

export interface Slot {
  time: string;
  endTime: string;
  available: boolean;
}

/**
 * Bir gün için zaman dilimleri.
 * @param opts.forPublic  true ise geçmiş + "minimum ön süre" içindeki dilimler ve bekleyen talepler de dolu sayılır.
 */
export async function getSlots(
  date: string,
  opts: { durationMinutes?: number; forPublic?: boolean; leadTimeHours?: number; ignoreAppointmentId?: string } = {},
): Promise<{ plan: DayPlan; slots: Slot[] }> {
  const plan = (await getDayPlans(date, date)).get(date)!;
  if (!plan.isWorking) return { plan, slots: [] };
  const duration = opts.durationMinutes ?? plan.slotMinutes;
  const step = plan.slotMinutes + plan.bufferMinutes;
  const busy = await busyIntervals(date, opts.forPublic ? SLOT_HOLDING_STATUSES : HARD_CONFLICT_STATUSES, prisma, opts.ignoreAppointmentId);

  const now = DateTime.now().setZone(TIME_ZONE);
  const minStart = now.plus({ hours: opts.forPublic ? (opts.leadTimeHours ?? 0) : 0 });
  const dayStart = DateTime.fromISO(date, { zone: TIME_ZONE }).startOf('day');

  const slots: Slot[] = [];
  for (const w of plan.windows) {
    for (let t = w.start; t + duration <= w.end; t += step) {
      const startDt = dayStart.plus({ minutes: t });
      const collides = busy.some((b) => t < b.end + plan.bufferMinutes && b.start < t + duration + plan.bufferMinutes);
      slots.push({ time: timeOf(t), endTime: timeOf(t + duration), available: !collides && startDt >= minStart });
    }
  }
  return { plan, slots };
}

export type SlotProblem =
  | 'PAST'
  | 'NOT_WORKING_DAY'
  | 'OUTSIDE_HOURS'
  | 'CONFLICT'
  | 'TOO_SOON'
  | 'TOO_FAR';

export const SLOT_PROBLEM_MESSAGE: Record<SlotProblem, string> = {
  PAST: 'Geçmiş bir tarih veya saat seçilemez.',
  NOT_WORKING_DAY: 'Seçilen gün çalışma günü değil veya takvim kapalı.',
  OUTSIDE_HOURS: 'Seçilen saat çalışma saatleri (veya öğle arası/kapalı aralık) ile uyumlu değil.',
  CONFLICT: 'Bu saat aralığında onaylanmış başka bir randevu var.',
  TOO_SOON: 'Bu saat için talep süresi geçti. Lütfen daha ileri bir saat seçin.',
  TOO_FAR: 'Bu tarih, randevu talebi alınabilecek süreden daha ileride.',
};

/**
 * Tek bir randevu aralığını doğrular. İlk sorunu fırlatır (409).
 * @param opts.statuses çakışma kontrolünde dikkate alınacak durumlar
 * @param opts.enforceHours false ise çalışma saati/gün kontrolü atlanır (panelde bilinçli "özel randevu")
 */
export async function assertSlotAllowed(
  db: Tx,
  input: { date: string; time: string; durationMinutes: number; ignoreAppointmentId?: string },
  opts: {
    statuses?: AppointmentStatus[];
    enforceHours?: boolean;
    allowPast?: boolean;
    leadTimeHours?: number;
    maxDaysAhead?: number;
  } = {},
) {
  const { date, time, durationMinutes } = input;
  const start = minutesOf(time);
  const end = start + durationMinutes;
  const startsAt = zonedToDate(date, time);
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
  const fail = (code: SlotProblem) => {
    throw conflict(code, SLOT_PROBLEM_MESSAGE[code]);
  };

  if (!opts.allowPast && startsAt.getTime() < Date.now()) fail('PAST');
  if (opts.leadTimeHours && startsAt.getTime() < Date.now() + opts.leadTimeHours * 36e5) fail('TOO_SOON');
  if (opts.maxDaysAhead && date > addDays(todayStr(), opts.maxDaysAhead)) fail('TOO_FAR');

  if (opts.enforceHours !== false) {
    const plan = (await getDayPlans(date, date, db)).get(date)!;
    if (!plan.isWorking) fail('NOT_WORKING_DAY');
    if (!plan.windows.some((w) => start >= w.start && end <= w.end)) fail('OUTSIDE_HOURS');
  }

  // Çakışma: dinlenme süresi de hesaba katılır (yalnızca kesin durumlar için kesin engel)
  const rule = await db.availabilityRule.findUnique({ where: { weekday: isoWeekday(date) } });
  const buffer = rule?.bufferMinutes ?? 0;
  const statuses = opts.statuses ?? HARD_CONFLICT_STATUSES;
  const clash = await db.appointment.findFirst({
    where: {
      status: { in: statuses },
      startsAt: { lt: new Date(endsAt.getTime() + buffer * 60_000) },
      endsAt: { gt: new Date(startsAt.getTime() - buffer * 60_000) },
      ...(input.ignoreAppointmentId ? { id: { not: input.ignoreAppointmentId } } : {}),
    },
    select: { id: true, startsAt: true, contactName: true },
  });
  if (clash) {
    throw conflict('CONFLICT', SLOT_PROBLEM_MESSAGE.CONFLICT, { conflictingAppointmentId: clash.id });
  }
  return { startsAt, endsAt };
}

/**
 * Randevu yazma işlemlerini serileştirir: aynı anda iki onay/oluşturma isteği
 * aynı boşluğu kapamaz. Kullanım:
 *   await withAppointmentLock(async (tx) => { await assertSlotAllowed(tx, ...); await tx.appointment.create(...) })
 */
export async function withAppointmentLock<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      // app_locks satırına yazma kilidi: transaction bitene kadar diğer randevu yazımları burada bekler.
      // Satır yoksa oluşturulur; varsa ON DUPLICATE KEY UPDATE mevcut satırı kilitler.
      await tx.$executeRaw`INSERT INTO app_locks (name) VALUES ('appointments') ON DUPLICATE KEY UPDATE name = name`;
      return fn(tx);
    },
    // READ COMMITTED: kilit alındıktan sonraki okumalar, bekleme sırasında commit edilen randevuları görür
    { timeout: 15_000, maxWait: 15_000, isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
  );
}

/** Randevunun gün/saat bilgisini İstanbul'a göre döndürür */
export function appointmentLocalParts(startsAt: Date | null) {
  if (!startsAt) return { date: null, time: null };
  const dt = DateTime.fromJSDate(startsAt).setZone(TIME_ZONE);
  return { date: toDateStr(startsAt), time: dt.toFormat('HH:mm') };
}
