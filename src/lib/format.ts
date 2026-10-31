export { slugify } from '@shared/text';
export { formatDate, formatDateLong, formatDateTime, formatTime, formatDayStr, relativeTime, toDateStr, toTimeStr, todayStr } from '@shared/time';

export function formatPhone(v: string | null | undefined) {
  if (!v) return '';
  const m = v.match(/^\+90(5\d{2})(\d{3})(\d{2})(\d{2})$/);
  return m ? `0${m[1]} ${m[2]} ${m[3]} ${m[4]}` : v;
}

export function formatMoney(cents: number | null | undefined) {
  if (cents == null) return '';
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(cents / 100);
}

export function fullName(p: { firstName: string; lastName: string }) {
  return `${p.firstName} ${p.lastName}`;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toLocaleUpperCase('tr-TR'))
    .join('');
}

export function cn(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}
