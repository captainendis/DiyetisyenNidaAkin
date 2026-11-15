// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import { describe, expect, it } from 'vitest';
import { defaultWhatsappTemplates, fillTemplate, toWhatsappNumber } from '../shared/whatsapp-templates';

describe('WhatsApp yardımcıları', () => {
  it('telefonu wa.me biçimine çevirir', () => {
    expect(toWhatsappNumber('+905551234567')).toBe('905551234567');
    expect(toWhatsappNumber('0555 123 45 67')).toBe('905551234567');
    expect(toWhatsappNumber('5551234567')).toBe('905551234567');
    expect(toWhatsappNumber('abc')).toBeNull();
    expect(toWhatsappNumber(null)).toBeNull();
  });

  it('değişkenleri doldurur', () => {
    const out = fillTemplate(defaultWhatsappTemplates.appointmentConfirmed, { ad: 'Ayşe', tarih: '1 Ocak 2027', saat: '10:00', referans: 'AB12CD' });
    expect(out).toContain('Ayşe');
    expect(out).not.toMatch(/\{(ad|tarih|saat|referans)\}/);
  });
});
