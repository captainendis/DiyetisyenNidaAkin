/** Müsaitlik kuralları — saf fonksiyon testleri (veritabanı gerekmez) */
import { describe, expect, it } from 'vitest';
import { buildDayPlan } from '../server/services/availability';

const rule = {
  isWorking: true,
  startTime: '09:00',
  endTime: '17:00',
  breakStart: '12:00',
  breakEnd: '13:00',
  slotMinutes: 45,
  bufferMinutes: 15,
};
const block = (b: Partial<{ kind: 'FULL_DAY' | 'CUSTOM_HOURS' | 'TIME_RANGE'; startTime: string | null; endTime: string | null; label: string | null }>) => ({
  kind: 'FULL_DAY' as const,
  label: null,
  reason: 'MANUAL' as const,
  startTime: null,
  endTime: null,
  ...b,
});

describe('buildDayPlan', () => {
  it('öğle arasını çalışma penceresinden çıkarır', () => {
    const p = buildDayPlan('2026-11-02', rule, []);
    expect(p.isWorking).toBe(true);
    expect(p.windows).toEqual([
      { start: 540, end: 720 },
      { start: 780, end: 1020 },
    ]);
  });

  it('çalışılmayan gün kapalıdır', () => {
    const p = buildDayPlan('2026-11-08', { ...rule, isWorking: false }, []);
    expect(p.isWorking).toBe(false);
    expect(p.windows).toEqual([]);
  });

  it('kural yoksa kapalıdır', () => {
    expect(buildDayPlan('2026-11-08', null, []).isWorking).toBe(false);
  });

  it('tüm gün kapalı istisnası her şeyi kapatır ve nedenini taşır', () => {
    const p = buildDayPlan('2026-11-02', rule, [block({ kind: 'FULL_DAY', label: 'Resmî tatil' })]);
    expect(p.isWorking).toBe(false);
    expect(p.closedReason).toBe('Resmî tatil');
  });

  it('özel çalışma saatleri haftalık kuralın yerine geçer (öğle arası korunur)', () => {
    const p = buildDayPlan('2026-11-02', rule, [block({ kind: 'CUSTOM_HOURS', startTime: '11:00', endTime: '15:00' })]);
    expect(p.windows).toEqual([
      { start: 660, end: 720 },
      { start: 780, end: 900 },
    ]);
  });

  it('özel çalışma saatleri normalde kapalı bir günü açabilir', () => {
    const p = buildDayPlan('2026-11-08', { ...rule, isWorking: false, breakStart: null, breakEnd: null }, [
      block({ kind: 'CUSTOM_HOURS', startTime: '10:00', endTime: '12:00' }),
    ]);
    expect(p.isWorking).toBe(true);
    expect(p.windows).toEqual([{ start: 600, end: 720 }]);
  });

  it('kapalı saat aralığı pencereyi böler', () => {
    const p = buildDayPlan('2026-11-02', rule, [block({ kind: 'TIME_RANGE', startTime: '14:00', endTime: '15:30' })]);
    expect(p.windows).toEqual([
      { start: 540, end: 720 },
      { start: 780, end: 840 },
      { start: 930, end: 1020 },
    ]);
  });

  it('tüm pencereyi kaplayan kapalı aralık günü kapatır', () => {
    const p = buildDayPlan('2026-11-02', { ...rule, breakStart: null, breakEnd: null }, [
      block({ kind: 'TIME_RANGE', startTime: '08:00', endTime: '18:00' }),
    ]);
    expect(p.isWorking).toBe(false);
  });
});
