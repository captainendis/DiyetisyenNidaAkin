/**
 * Saat dilimi yardımcıları — tüm iş kuralları Europe/Istanbul'da hesaplanır.
 * Veritabanında UTC (timestamptz) saklanır; ekranda ve kurallarda yerel saat kullanılır.
 */
import { DateTime, Settings } from 'luxon';
import { TIME_ZONE } from './constants';

Settings.defaultLocale = 'tr';

/** "2026-11-02" + "10:30" (İstanbul) → UTC Date */
export function zonedToDate(date: string, time: string): Date {
  const dt = DateTime.fromISO(`${date}T${time}`, { zone: TIME_ZONE });
  if (!dt.isValid) throw new Error(`Geçersiz tarih/saat: ${date} ${time}`);
  return dt.toJSDate();
}

/** Date → İstanbul DateTime */
export function inTz(d: Date | string): DateTime {
  return (typeof d === 'string' ? DateTime.fromISO(d) : DateTime.fromJSDate(d)).setZone(TIME_ZONE);
}

/** Date → "YYYY-MM-DD" (İstanbul) */
export function toDateStr(d: Date | string): string {
  return inTz(d).toISODate()!;
}

/** Date → "HH:mm" (İstanbul) */
export function toTimeStr(d: Date | string): string {
  return inTz(d).toFormat('HH:mm');
}

/** Bugün (İstanbul) "YYYY-MM-DD" */
export function todayStr(): string {
  return DateTime.now().setZone(TIME_ZONE).toISODate()!;
}

/** "HH:mm" → gün başından itibaren dakika */
export function minutesOf(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** dakika → "HH:mm" */
export function timeOf(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** "YYYY-MM-DD" için ISO gün numarası (1 = Pazartesi) */
export function isoWeekday(date: string): number {
  return DateTime.fromISO(date, { zone: TIME_ZONE }).weekday;
}

export function addDays(date: string, days: number): string {
  return DateTime.fromISO(date, { zone: TIME_ZONE }).plus({ days }).toISODate()!;
}

/** İki tarih arasındaki (dahil) tüm günler */
export function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  let cur = from;
  let guard = 0;
  while (cur <= to && guard++ < 1000) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

/** "YYYY-MM-DD" günün başlangıcı (İstanbul) → UTC Date */
export function startOfDay(date: string): Date {
  return DateTime.fromISO(date, { zone: TIME_ZONE }).startOf('day').toJSDate();
}
/** "YYYY-MM-DD" ertesi günün başlangıcı (İstanbul) → UTC Date (yarı açık aralık için) */
export function endOfDayExclusive(date: string): Date {
  return DateTime.fromISO(date, { zone: TIME_ZONE }).plus({ days: 1 }).startOf('day').toJSDate();
}

// ───────────────────────── Biçimlendirme (tr-TR) ─────────────────────────

export function formatDateLong(d: Date | string): string {
  return inTz(d).toFormat('d MMMM yyyy, cccc');
}
export function formatDate(d: Date | string): string {
  return inTz(d).toFormat('d MMM yyyy');
}
export function formatDateTime(d: Date | string): string {
  return inTz(d).toFormat("d MMM yyyy, HH:mm");
}
export function formatTime(d: Date | string): string {
  return inTz(d).toFormat('HH:mm');
}
/** "YYYY-MM-DD" metnini biçimlendir (saat dilimi kaymasından bağımsız) */
export function formatDayStr(date: string, fmt = 'd MMMM yyyy'): string {
  return DateTime.fromISO(date, { zone: TIME_ZONE }).toFormat(fmt);
}
export function relativeTime(d: Date | string): string {
  return inTz(d).toRelative({ locale: 'tr' }) ?? '';
}
