// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Vücut kompozisyonu — ölçümlerden otomatik hesaplanan değerler.
 *
 * Yağ oranı kaynağı, öncelik sırasıyla:
 *  1. "device": vücut analizi cihazından (tartı) girilen yağ oranı
 *  2. "rfm":    Relative Fat Mass — boy ve bel çevresinden (Woolcott & Bergman, 2018)
 *               %yağ = 64 − 20 × (boy / bel) + 12 × (kadın ? 1 : 0)
 *  3. "bmi":    Deurenberg (1991) — BKİ, yaş ve cinsiyetten
 *               %yağ = 1,2 × BKİ + 0,23 × yaş − 10,8 × (erkek ? 1 : 0) − 5,4
 * Yağsız kütle = kilo − yağ kütlesi (kas + su + kemik + organlar). Kas kütlesinin kendisi
 * yalnızca cihazdan girildiğinde bilinir; mezura ile yalnızca yağsız kütle tahmin edilir.
 *
 * Değişimler yalnızca aynı yöntemle hesaplanmış iki ölçüm arasında verilir; cihaz değeriyle
 * formül tahmini karşılaştırılmaz.
 */

import type { ClientSex } from './constants';
import { CIRCUMFERENCES, type Circumferences } from './measurements';

export type FatMethod = 'device' | 'rfm' | 'bmi';

export const FAT_METHOD_LABEL: Record<FatMethod, string> = {
  device: 'vücut analizi cihazı',
  rfm: 'bel–boy formülü (tahmini)',
  bmi: 'BKİ–yaş formülü (tahmini)',
};

export interface CompositionInput extends Partial<Circumferences> {
  id: string;
  measuredOn: string;
  heightCm: number | null;
  weightKg: number | null;
  bodyFatPct?: number | null;
  muscleKg?: number | null;
}

export interface Composition {
  id: string;
  measuredOn: string;
  weightKg: number | null;
  /** Ölçümde boy yoksa önceki (yoksa sonraki) ölçümün boyu */
  heightCm: number | null;
  bmi: number | null;
  bmiCategory: string | null;
  /** Bel / boy oranı; 0,5 üzeri risk */
  waistToHeight: number | null;
  /** Bel / kalça oranı */
  waistToHip: number | null;
  waistToHipRisk: boolean | null;
  fatPct: number | null;
  fatMethod: FatMethod | null;
  fatKg: number | null;
  leanKg: number | null;
  muscleKg: number | null;
}

export interface CompositionChange {
  from: string;
  to: string;
  weightKg: number | null;
  fatKg: number | null;
  leanKg: number | null;
  fatMethod: FatMethod | null;
  muscleKg: number | null;
  waistCm: number | null;
  /** Her iki ölçümde de girilmiş mezura çevrelerinin toplam değişimi */
  totalCm: number | null;
  totalCmParts: number;
  bmi: number | null;
}

export interface CompositionProfile {
  sex: ClientSex | null;
  birthDate: string | null;
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;

export function bmiCategory(bmi: number): string {
  if (bmi < 18.5) return 'Zayıf';
  if (bmi < 25) return 'Normal';
  if (bmi < 30) return 'Fazla kilolu';
  if (bmi < 35) return 'Obez (1. derece)';
  if (bmi < 40) return 'Obez (2. derece)';
  return 'Obez (3. derece)';
}

export function ageOn(birthDate: string | null, on: string): number | null {
  if (!birthDate) return null;
  const [by, bm, bd] = birthDate.split('-').map(Number);
  const [y, m, d] = on.split('-').map(Number);
  if (!by || !y) return null;
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}

/** Tek ölçümün hesapları; `heightCm` boy taşınmış olarak verilmelidir */
export function compose(m: CompositionInput, heightCm: number | null, p: CompositionProfile): Composition {
  const w = m.weightKg;
  const h = heightCm;
  const bmi = w != null && h ? r1(w / (h / 100) ** 2) : null;
  const waist = m.waistCm ?? null;
  const hip = m.hipCm ?? m.basenCm ?? null;
  const waistToHip = waist && hip ? r2(waist / hip) : null;

  let fatPct: number | null = null;
  let fatMethod: FatMethod | null = null;
  const age = ageOn(p.birthDate, m.measuredOn);
  if (m.bodyFatPct != null) {
    fatPct = m.bodyFatPct;
    fatMethod = 'device';
  } else if (p.sex && h && waist) {
    fatPct = 64 - 20 * (h / waist) + (p.sex === 'FEMALE' ? 12 : 0);
    fatMethod = 'rfm';
  } else if (p.sex && bmi != null && age != null && age >= 18) {
    fatPct = 1.2 * bmi + 0.23 * age - (p.sex === 'MALE' ? 10.8 : 0) - 5.4;
    fatMethod = 'bmi';
  }
  if (fatPct != null) fatPct = r1(Math.min(70, Math.max(3, fatPct)));
  const fatKg = fatPct != null && w != null ? r1((w * fatPct) / 100) : null;

  return {
    id: m.id,
    measuredOn: m.measuredOn,
    weightKg: w,
    heightCm: h,
    bmi,
    bmiCategory: bmi != null ? bmiCategory(bmi) : null,
    waistToHeight: waist && h ? r2(waist / h) : null,
    waistToHip,
    waistToHipRisk: waistToHip != null && p.sex ? waistToHip >= (p.sex === 'FEMALE' ? 0.85 : 0.9) : null,
    fatPct,
    fatMethod,
    fatKg,
    leanKg: fatKg != null && w != null ? r1(w - fatKg) : null,
    muscleKg: m.muscleKg ?? null,
  };
}

/** Tüm ölçümlerin hesapları, tarih sırasına göre (eskiden yeniye) */
export function composeAll(items: CompositionInput[], p: CompositionProfile): Composition[] {
  const asc = [...items].sort((a, b) => a.measuredOn.localeCompare(b.measuredOn));
  let lastHeight: number | null = null;
  const firstHeight = asc.find((m) => m.heightCm != null)?.heightCm ?? null;
  return asc.map((m) => {
    if (m.heightCm != null) lastHeight = m.heightCm;
    return compose(m, m.heightCm ?? lastHeight ?? firstHeight, p);
  });
}

function firstLast<T>(xs: T[], ok: (x: T) => boolean): [T, T] | null {
  const f = xs.find(ok);
  const l = [...xs].reverse().find(ok);
  return f && l && f !== l ? [f, l] : null;
}

/** İlk ve son ölçüm arasındaki değişimler (her değer için uygun ilk/son ölçüm çifti seçilir) */
export function compositionChange(items: CompositionInput[], p: CompositionProfile): CompositionChange | null {
  const asc = [...items].sort((a, b) => a.measuredOn.localeCompare(b.measuredOn));
  const comp = composeAll(asc, p);
  if (comp.length < 2) return null;

  const weight = firstLast(comp, (c) => c.weightKg != null);

  // Yağ: önce cihaz, sonra formüller — iki uç aynı yöntemle hesaplanmış olmalı
  let fat: [Composition, Composition] | null = null;
  for (const method of ['device', 'rfm', 'bmi'] as const) {
    fat = firstLast(comp, (c) => c.fatMethod === method && c.fatKg != null);
    if (fat) break;
  }
  const muscle = firstLast(comp, (c) => c.muscleKg != null);
  const bmi = firstLast(comp, (c) => c.bmi != null);
  const waist = firstLast(asc, (m) => m.waistCm != null);

  const hasCirc = (m: CompositionInput) => CIRCUMFERENCES.some(({ key }) => m[key] != null);
  const circ = firstLast(asc, hasCirc);
  let totalCm: number | null = null;
  let totalCmParts = 0;
  if (circ) {
    const [a, b] = circ;
    for (const { key } of CIRCUMFERENCES) {
      const x = a[key];
      const y = b[key];
      if (x != null && y != null) {
        totalCm = (totalCm ?? 0) + (y - x);
        totalCmParts++;
      }
    }
  }

  const from = (weight ?? fat ?? circ)?.[0].measuredOn ?? comp[0].measuredOn;
  const to = (weight ?? fat ?? circ)?.[1].measuredOn ?? comp[comp.length - 1].measuredOn;
  return {
    from,
    to,
    weightKg: weight ? r1(weight[1].weightKg! - weight[0].weightKg!) : null,
    fatKg: fat ? r1(fat[1].fatKg! - fat[0].fatKg!) : null,
    leanKg: fat ? r1(fat[1].leanKg! - fat[0].leanKg!) : null,
    fatMethod: fat ? fat[0].fatMethod : null,
    muscleKg: muscle ? r1(muscle[1].muscleKg! - muscle[0].muscleKg!) : null,
    waistCm: waist ? r1(waist[1].waistCm! - waist[0].waistCm!) : null,
    totalCm: totalCm != null ? r1(totalCm) : null,
    totalCmParts,
    bmi: bmi ? r1(bmi[1].bmi! - bmi[0].bmi!) : null,
  };
}
