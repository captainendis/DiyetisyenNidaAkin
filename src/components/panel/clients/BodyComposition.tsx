// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import type { ReactNode } from 'react';
import { formatDayStr } from '@/lib/format';
import {
  FAT_METHOD_LABEL,
  composeAll,
  compositionChange,
  type CompositionInput,
  type CompositionProfile,
} from '@shared/body-composition';

const n1 = (v: number) => v.toLocaleString('tr-TR', { maximumFractionDigits: 1 });
const n2 = (v: number) => v.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** +1,2 / −1,2 (gerçek eksi işareti) */
const signed = (v: number, unit: string) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${n1(Math.abs(v))} ${unit}`;

type Tone = 'good' | 'bad' | 'neutral';
const toneClass: Record<Tone, string> = { good: 'text-success-ink', bad: 'text-rose-ink', neutral: 'text-espresso' };

function Tile({ label, value, sub, tone = 'neutral' }: { label: string; value: ReactNode; sub?: ReactNode; tone?: Tone }) {
  return (
    <div className="bg-white p-4">
      <dt className="text-[0.72rem] font-semibold tracking-wide text-panel-muted uppercase">{label}</dt>
      <dd className={`tabular mt-1.5 text-[1.05rem] font-semibold ${toneClass[tone]}`}>{value}</dd>
      {sub && <dd className="mt-0.5 text-[0.72rem] text-panel-muted">{sub}</dd>}
    </div>
  );
}

/**
 * Ölçümlerden otomatik hesaplanan vücut kompozisyonu: son durum ve ilk ölçümden bu yana değişim.
 * `audience="client"` danışan hesabında kullanılır (eksik veri uyarıları gösterilmez).
 */
export function BodyComposition({ items, profile, audience = 'staff' }: { items: CompositionInput[]; profile: CompositionProfile; audience?: 'staff' | 'client' }) {
  const all = composeAll(items, profile);
  const last = [...all].reverse().find((c) => c.weightKg != null || c.fatPct != null || c.waistToHeight != null);
  if (!last) return null;
  const change = compositionChange(items, profile);
  const lastIn = items.find((m) => m.id === last.id);

  const hints: string[] = [];
  if (audience === 'staff') {
    if (!profile.sex) hints.push('Yağ oranının hesaplanması için danışan bilgilerine cinsiyet ekleyin.');
    if (!last.heightCm) hints.push('Boy girilmemiş; BKİ ve yağ oranı için en az bir ölçümde boy girin.');
    if (profile.sex && last.fatMethod !== 'device' && lastIn?.waistCm == null) hints.push('Bel ölçüsü girilince yağ oranı bel–boy formülüyle daha doğru tahmin edilir.');
  }

  const lossSentence =
    change && change.fatKg != null && change.leanKg != null && change.fatKg + change.leanKg < 0 && change.fatKg < 0
      ? `Verilen ${n1(Math.abs(change.fatKg + change.leanKg))} kg'ın ${n1(Math.abs(change.fatKg))} kg'ı yağ${
          change.leanKg < 0 ? `, ${n1(Math.abs(change.leanKg))} kg'ı yağsız kütle` : ''
        }${change.leanKg > 0 ? `; yağsız kütle ${n1(change.leanKg)} kg arttı` : ''}.`
      : null;

  return (
    <div className="space-y-5">
      <section aria-labelledby="bc-now">
        <h3 id="bc-now" className="mb-2 text-[0.95rem] font-bold text-espresso">
          Son durum <span className="font-medium text-panel-muted">· {formatDayStr(last.measuredOn, 'd MMM yyyy')}</span>
        </h3>
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-panel-line bg-panel-line sm:grid-cols-3 xl:grid-cols-5">
          <Tile label="BKİ" value={last.bmi != null ? n1(last.bmi) : '—'} sub={last.bmiCategory ?? 'Boy ve kilo gerekli'} />
          <Tile
            label="Yağ oranı"
            value={last.fatPct != null ? `%${n1(last.fatPct)}${last.fatKg != null ? ` · ${n1(last.fatKg)} kg` : ''}` : '—'}
            sub={last.fatMethod ? FAT_METHOD_LABEL[last.fatMethod] : 'Hesaplanamadı'}
          />
          {last.muscleKg != null ? (
            <Tile label="Kas kütlesi" value={`${n1(last.muscleKg)} kg`} sub={FAT_METHOD_LABEL.device} />
          ) : (
            <Tile label="Yağsız kütle" value={last.leanKg != null ? `${n1(last.leanKg)} kg` : '—'} sub="Kas, su, kemik, organlar" />
          )}
          <Tile
            label="Bel / boy"
            value={last.waistToHeight != null ? n2(last.waistToHeight) : '—'}
            sub={last.waistToHeight != null ? (last.waistToHeight >= 0.5 ? '0,50 ve üzeri: artmış risk' : '0,50 altı: hedef aralıkta') : 'Bel ölçüsü gerekli'}
            tone={last.waistToHeight != null && last.waistToHeight >= 0.5 ? 'bad' : 'neutral'}
          />
          <Tile
            label="Bel / kalça"
            value={last.waistToHip != null ? n2(last.waistToHip) : '—'}
            sub={
              last.waistToHip == null
                ? 'Bel ve kalça gerekli'
                : last.waistToHipRisk == null
                  ? 'Risk eşiği cinsiyete göre'
                  : last.waistToHipRisk
                    ? `${profile.sex === 'FEMALE' ? '0,85' : '0,90'} ve üzeri: artmış risk`
                    : `${profile.sex === 'FEMALE' ? '0,85' : '0,90'} altı: hedef aralıkta`
            }
            tone={last.waistToHipRisk ? 'bad' : 'neutral'}
          />
        </dl>
      </section>

      {change && (
        <section aria-labelledby="bc-change">
          <h3 id="bc-change" className="mb-2 text-[0.95rem] font-bold text-espresso">
            İlk ölçümden bu yana{' '}
            <span className="font-medium text-panel-muted">
              · {formatDayStr(change.from, 'd MMM yyyy')} → {formatDayStr(change.to, 'd MMM yyyy')}
            </span>
          </h3>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-panel-line bg-panel-line sm:grid-cols-3 xl:grid-cols-5">
            <Tile label="Kilo" value={change.weightKg != null ? signed(change.weightKg, 'kg') : '—'} sub={change.bmi != null ? `BKİ ${signed(change.bmi, '').trim()}` : undefined} />
            <Tile
              label="Yağ"
              value={change.fatKg != null ? signed(change.fatKg, 'kg') : '—'}
              sub={change.fatMethod ? FAT_METHOD_LABEL[change.fatMethod] : 'Aynı yöntemle iki ölçüm gerekli'}
              tone={change.fatKg == null || change.fatKg === 0 ? 'neutral' : change.fatKg < 0 ? 'good' : 'bad'}
            />
            {change.muscleKg != null ? (
              <Tile
                label="Kas"
                value={signed(change.muscleKg, 'kg')}
                sub={FAT_METHOD_LABEL.device}
                tone={change.muscleKg === 0 ? 'neutral' : change.muscleKg > 0 ? 'good' : 'bad'}
              />
            ) : (
              <Tile
                label="Yağsız kütle"
                value={change.leanKg != null ? signed(change.leanKg, 'kg') : '—'}
                sub="Kas dahil; tahmini"
                tone={change.leanKg == null || change.leanKg === 0 ? 'neutral' : change.leanKg > 0 ? 'good' : 'bad'}
              />
            )}
            <Tile label="Bel" value={change.waistCm != null ? signed(change.waistCm, 'cm') : '—'} />
            <Tile
              label="Toplam çevre"
              value={change.totalCm != null ? signed(change.totalCm, 'cm') : '—'}
              sub={change.totalCmParts ? `${change.totalCmParts} bölgenin toplamı` : 'Mezura ölçüsü gerekli'}
            />
          </dl>
          {lossSentence && <p className="mt-3 text-[0.9rem] text-cocoa">{lossSentence}</p>}
        </section>
      )}

      {hints.length > 0 && (
        <ul className="space-y-1 text-[0.82rem] text-cocoa">
          {hints.map((h) => (
            <li key={h}>· {h}</li>
          ))}
        </ul>
      )}
      <p className="text-[0.75rem] leading-relaxed text-panel-muted">
        Değerler otomatik hesaplanır. Cihaz değeri girilmemişse yağ oranı formülle tahmin edilir (bel–boy: Woolcott ve Bergman 2018; BKİ–yaş: Deurenberg 1991)
        ve birkaç puan sapabilir. Mezura ile kasın kendisi değil, kası da içeren yağsız kütle tahmin edilir; kas kütlesi için vücut analizi cihazının değerini girin.
      </p>
    </div>
  );
}
