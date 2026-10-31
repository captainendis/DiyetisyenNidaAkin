import type { ContactInfo } from '@shared/site-config';

/** "Açık adres, 34538 Esenyurt/İstanbul" biçiminde tam adres; eksikse null */
export function formatAddress(c: Pick<ContactInfo, 'addressLine' | 'district' | 'city' | 'postalCode'>): string | null {
  if (!c.addressLine) return null;
  const place = [c.district, c.city].filter(Boolean).join('/');
  const tail = [c.postalCode, place].filter(Boolean).join(' ');
  return tail ? `${c.addressLine}, ${tail}` : c.addressLine;
}

/** Kısa konum: "Esenyurt, İstanbul" */
export function shortPlace(c: Pick<ContactInfo, 'district' | 'city'>): string | null {
  return [c.district, c.city].filter(Boolean).join(', ') || null;
}
