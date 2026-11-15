// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import { describe, expect, it } from 'vitest';
import { measurementSchema } from '../shared/schemas';
import { CIRCUMFERENCES, pickCircumferences } from '../shared/measurements';

describe('mezura ölçüleri', () => {
  it('çizelgedeki sekiz ölçüyü sırasıyla tanımlar', () => {
    expect(CIRCUMFERENCES.map((c) => c.label)).toEqual(['Göğüs', 'Göğüs altı', 'Bel', 'Karın', 'Kalça', 'Basen', 'Bacak', 'Kol']);
  });

  it('şema mezura değerlerini kabul eder, aralık dışını reddeder', () => {
    const ok = measurementSchema.safeParse({ measuredOn: '2026-11-15', waistCm: 72.5, armCm: null });
    expect(ok.success && ok.data.waistCm).toBe(72.5);
    expect(measurementSchema.safeParse({ measuredOn: '2026-11-15', hipCm: 900 }).success).toBe(false);
  });

  it('eski kayıtlarda eksik ölçüler null döner', () => {
    const c = pickCircumferences({ weightKg: 70, waistCm: 80 });
    expect(c.waistCm).toBe(80);
    expect(c.chestCm).toBeNull();
  });
});
