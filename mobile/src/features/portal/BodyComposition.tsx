// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Ölçümlerden otomatik hesaplanan vücut kompozisyonu (web: BodyComposition, audience="client"):
 * son durum ve ilk ölçümden bu yana değişim. Hesaplar @shared/body-composition'dan gelir.
 */
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { FAT_METHOD_LABEL, composeAll, compositionChange, type CompositionInput, type CompositionProfile } from '@shared/body-composition';
import { T } from '@/components/ui';
import { formatDayStr } from '@/lib/format';
import { colors, fonts, radius, space } from '@/theme';

const n1 = (v: number) => v.toLocaleString('tr-TR', { maximumFractionDigits: 1 });
const n2 = (v: number) => v.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const signed = (v: number, unit: string) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${n1(Math.abs(v))} ${unit}`.trim();

type Tone = 'good' | 'bad' | 'neutral';
const toneColor: Record<Tone, string> = { good: colors.successInk, bad: colors.roseInk, neutral: colors.text };

function Tile({ label, value, sub, tone = 'neutral' }: { label: string; value: ReactNode; sub?: string; tone?: Tone }) {
  return (
    <View style={styles.tile}>
      <T variant="overline" color={colors.muted} style={{ letterSpacing: 0.8 }}>{label}</T>
      <T style={{ fontFamily: fonts.semibold, fontSize: 16, color: toneColor[tone], marginTop: 4 }}>{value}</T>
      {sub ? <T variant="caption" style={{ fontSize: 11, lineHeight: 15, marginTop: 2 }}>{sub}</T> : null}
    </View>
  );
}

function Tiles({ children }: { children: ReactNode[] }) {
  return <View style={styles.grid}>{children}</View>;
}

export function BodyComposition({ items, profile }: { items: CompositionInput[]; profile: CompositionProfile }) {
  const all = composeAll(items, profile);
  const last = [...all].reverse().find((c) => c.weightKg != null || c.fatPct != null || c.waistToHeight != null);
  if (!last) return null;
  const change = compositionChange(items, profile);
  const thr = profile.sex === 'FEMALE' ? '0,85' : '0,90';

  const lossSentence =
    change && change.fatKg != null && change.leanKg != null && change.fatKg + change.leanKg < 0 && change.fatKg < 0
      ? `Verilen ${n1(Math.abs(change.fatKg + change.leanKg))} kg'ın ${n1(Math.abs(change.fatKg))} kg'ı yağ${
          change.leanKg < 0 ? `, ${n1(Math.abs(change.leanKg))} kg'ı yağsız kütle` : ''
        }${change.leanKg > 0 ? `; yağsız kütle ${n1(change.leanKg)} kg arttı` : ''}.`
      : null;

  return (
    <View style={{ gap: space.lg }}>
      <View style={{ gap: space.sm }}>
        <T variant="label">
          Son durum <T variant="caption">· {formatDayStr(last.measuredOn, 'd MMM yyyy')}</T>
        </T>
        <Tiles>
          {[
            <Tile key="bmi" label="BKİ" value={last.bmi != null ? n1(last.bmi) : '—'} sub={last.bmiCategory ?? 'Boy ve kilo gerekli'} />,
            <Tile
              key="fat"
              label="Yağ oranı"
              value={last.fatPct != null ? `%${n1(last.fatPct)}${last.fatKg != null ? ` · ${n1(last.fatKg)} kg` : ''}` : '—'}
              sub={last.fatMethod ? FAT_METHOD_LABEL[last.fatMethod] : 'Hesaplanamadı'}
            />,
            last.muscleKg != null ? (
              <Tile key="m" label="Kas kütlesi" value={`${n1(last.muscleKg)} kg`} sub={FAT_METHOD_LABEL.device} />
            ) : (
              <Tile key="m" label="Yağsız kütle" value={last.leanKg != null ? `${n1(last.leanKg)} kg` : '—'} sub="Kas, su, kemik, organlar" />
            ),
            <Tile
              key="wh"
              label="Bel / boy"
              value={last.waistToHeight != null ? n2(last.waistToHeight) : '—'}
              sub={last.waistToHeight != null ? (last.waistToHeight >= 0.5 ? '0,50 ve üzeri: artmış risk' : '0,50 altı: hedef aralıkta') : 'Bel ölçüsü gerekli'}
              tone={last.waistToHeight != null && last.waistToHeight >= 0.5 ? 'bad' : 'neutral'}
            />,
            <Tile
              key="whr"
              label="Bel / kalça"
              value={last.waistToHip != null ? n2(last.waistToHip) : '—'}
              sub={
                last.waistToHip == null
                  ? 'Bel ve kalça gerekli'
                  : last.waistToHipRisk == null
                    ? 'Risk eşiği cinsiyete göre'
                    : last.waistToHipRisk
                      ? `${thr} ve üzeri: artmış risk`
                      : `${thr} altı: hedef aralıkta`
              }
              tone={last.waistToHipRisk ? 'bad' : 'neutral'}
            />,
          ]}
        </Tiles>
      </View>

      {change ? (
        <View style={{ gap: space.sm }}>
          <T variant="label">
            İlk ölçümden bu yana <T variant="caption">· {formatDayStr(change.from, 'd MMM yyyy')} → {formatDayStr(change.to, 'd MMM yyyy')}</T>
          </T>
          <Tiles>
            {[
              <Tile key="w" label="Kilo" value={change.weightKg != null ? signed(change.weightKg, 'kg') : '—'} sub={change.bmi != null ? `BKİ ${signed(change.bmi, '')}` : undefined} />,
              <Tile
                key="f"
                label="Yağ"
                value={change.fatKg != null ? signed(change.fatKg, 'kg') : '—'}
                sub={change.fatMethod ? FAT_METHOD_LABEL[change.fatMethod] : 'Aynı yöntemle iki ölçüm gerekli'}
                tone={change.fatKg == null || change.fatKg === 0 ? 'neutral' : change.fatKg < 0 ? 'good' : 'bad'}
              />,
              change.muscleKg != null ? (
                <Tile key="m" label="Kas" value={signed(change.muscleKg, 'kg')} sub={FAT_METHOD_LABEL.device} tone={change.muscleKg === 0 ? 'neutral' : change.muscleKg > 0 ? 'good' : 'bad'} />
              ) : (
                <Tile
                  key="m"
                  label="Yağsız kütle"
                  value={change.leanKg != null ? signed(change.leanKg, 'kg') : '—'}
                  sub="Kas dahil; tahmini"
                  tone={change.leanKg == null || change.leanKg === 0 ? 'neutral' : change.leanKg > 0 ? 'good' : 'bad'}
                />
              ),
              <Tile key="b" label="Bel" value={change.waistCm != null ? signed(change.waistCm, 'cm') : '—'} />,
              <Tile
                key="t"
                label="Toplam çevre"
                value={change.totalCm != null ? signed(change.totalCm, 'cm') : '—'}
                sub={change.totalCmParts ? `${change.totalCmParts} bölgenin toplamı` : 'Mezura ölçüsü gerekli'}
              />,
            ]}
          </Tiles>
          {lossSentence ? <T variant="caption" color={colors.cocoa}>{lossSentence}</T> : null}
        </View>
      ) : null}

      <T variant="caption" style={{ fontSize: 11, lineHeight: 16 }}>
        Değerler otomatik hesaplanır. Cihaz değeri girilmemişse yağ oranı formülle tahmin edilir (bel–boy: Woolcott ve Bergman 2018; BKİ–yaş: Deurenberg 1991)
        ve birkaç puan sapabilir. Mezura ile kasın kendisi değil, kası da içeren yağsız kütle tahmin edilir.
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 1, backgroundColor: colors.line, borderRadius: radius.md, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  tile: { backgroundColor: colors.surface, padding: space.md, flexGrow: 1, flexBasis: '45%' },
});
