// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import { describe, expect, it } from 'vitest';
import { ageOn, composeAll, compositionChange, type CompositionInput } from '../shared/body-composition';

const base = { heightCm: null, weightKg: null } as const;
const woman = { sex: 'FEMALE' as const, birthDate: '1990-06-15' };

describe('vücut kompozisyonu', () => {
  it('BKİ ve kategorisi; boy önceki ölçümden taşınır', () => {
    const [a, b] = composeAll(
      [
        { ...base, id: 'a', measuredOn: '2026-01-01', heightCm: 165, weightKg: 70 },
        { ...base, id: 'b', measuredOn: '2026-02-01', weightKg: 66 },
      ],
      woman,
    );
    expect(a.bmi).toBe(25.7);
    expect(a.bmiCategory).toBe('Fazla kilolu');
    expect(b.heightCm).toBe(165);
    expect(b.bmi).toBe(24.2);
  });

  it('bel varsa RFM, yoksa Deurenberg; cihaz değeri hepsinden önce gelir', () => {
    const [rfm, dbg, dev] = composeAll(
      [
        { ...base, id: 'r', measuredOn: '2026-01-01', heightCm: 165, weightKg: 70, waistCm: 80 },
        { ...base, id: 'd', measuredOn: '2026-01-02', heightCm: 165, weightKg: 70 },
        { ...base, id: 'c', measuredOn: '2026-01-03', heightCm: 165, weightKg: 70, waistCm: 80, bodyFatPct: 30, muscleKg: 26 },
      ],
      woman,
    );
    // 64 − 20 × 165/80 + 12 = 34,75
    expect(rfm.fatMethod).toBe('rfm');
    expect(rfm.fatPct).toBe(34.8);
    expect(rfm.fatKg).toBe(24.4);
    expect(rfm.leanKg).toBe(45.6);
    expect(rfm.waistToHeight).toBe(0.48);
    // 1,2 × 25,7 + 0,23 × 35 − 5,4 = 33,49
    expect(dbg.fatMethod).toBe('bmi');
    expect(dbg.fatPct).toBe(33.5);
    expect(dev.fatMethod).toBe('device');
    expect(dev.fatKg).toBe(21);
    expect(dev.muscleKg).toBe(26);
  });

  it('cinsiyet yoksa yağ oranı hesaplanmaz', () => {
    const [a] = composeAll([{ ...base, id: 'a', measuredOn: '2026-01-01', heightCm: 165, weightKg: 70, waistCm: 80 }], { sex: null, birthDate: null });
    expect(a.fatPct).toBeNull();
    expect(a.bmi).toBe(25.7);
  });

  it('değişim: yağ ve yağsız kütle aynı yöntemle, toplam çevre ortak bölgelerle', () => {
    const items: CompositionInput[] = [
      { ...base, id: 'a', measuredOn: '2026-01-01', heightCm: 165, weightKg: 75, waistCm: 90, hipCm: 105, armCm: 30 },
      { ...base, id: 'b', measuredOn: '2026-02-01', weightKg: 72, waistCm: 85, bodyFatPct: 30 },
      { ...base, id: 'c', measuredOn: '2026-03-01', weightKg: 70, waistCm: 80, hipCm: 100 },
    ];
    const ch = compositionChange(items, woman)!;
    expect(ch.weightKg).toBe(-5);
    expect(ch.fatMethod).toBe('rfm');
    // ilk: %39,3 × 75 = 29,5 kg; son: %34,8 × 70 = 24,4 kg
    expect(ch.fatKg).toBe(-5.1);
    expect(ch.leanKg).toBe(0.1);
    expect(ch.waistCm).toBe(-10);
    expect(ch.totalCm).toBe(-15);
    expect(ch.totalCmParts).toBe(2);
  });

  it('yaş doğum gününe göre', () => {
    expect(ageOn('1990-06-15', '2026-06-14')).toBe(35);
    expect(ageOn('1990-06-15', '2026-06-15')).toBe(36);
  });
});
