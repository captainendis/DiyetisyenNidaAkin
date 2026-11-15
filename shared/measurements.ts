// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Mezura ölçüleri — "Mezura Takip Çizelgesi"ndeki sütunlar, aynı sırayla.
 * Değerler ölçümün şifreli JSON'unda (Measurement.dataEnc) santimetre olarak saklanır.
 */
export const CIRCUMFERENCES = [
  { key: 'chestCm', label: 'Göğüs' },
  { key: 'underbustCm', label: 'Göğüs altı' },
  { key: 'waistCm', label: 'Bel' },
  { key: 'abdomenCm', label: 'Karın' },
  { key: 'hipCm', label: 'Kalça' },
  { key: 'basenCm', label: 'Basen' },
  { key: 'legCm', label: 'Bacak' },
  { key: 'armCm', label: 'Kol' },
] as const;

export type CircumferenceKey = (typeof CIRCUMFERENCES)[number]['key'];
export type Circumferences = Record<CircumferenceKey, number | null>;

/** Şifresi çözülmüş veriden mezura ölçülerini çıkarır; eksik olanlar null */
export function pickCircumferences(d: object): Circumferences {
  const out = {} as Circumferences;
  for (const { key } of CIRCUMFERENCES) {
    const v = (d as Partial<Record<CircumferenceKey, unknown>>)[key];
    out[key] = typeof v === 'number' ? v : null;
  }
  return out;
}
