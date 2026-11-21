// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Ölçümlerden otomatik hesaplanan vücut kompozisyonu: son durum ve ilk ölçümden bu yana değişim */
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { T } from '@/components/ui';
import { formatDayStr } from '@/lib/format';
import { FAT_METHOD_LABEL, composeAll, compositionChange, type CompositionInput, type CompositionProfile } from '@shared/body-composition';
import { colors, fonts, radius, space } from '@/theme';
import { n1, n2 } from './common';

/** +1,2 / −1,2 (gerçek eksi işareti) */
const signed = (v: number, unit: string) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${n1(Math.abs(v))} ${unit}`.trim();

type Tone = 'good' | 'bad' | 'neutral';
const toneColor: Record<Tone, string> = { good: colors.successInk, bad: colors.roseInk, neutral: colors.text };

function Tile({ label, value, sub, tone = 'neutral' }: { label: string; value: ReactNode; sub?: ReactNode; tone?: Tone }) {
  return (
    <View style={styles.tile}>
      <T variant="overline" color={colors.muted}>{label}</T>
      <T style={{ fontFamily: fonts.semibold, fontSize: 16, color: toneColor[tone], marginTop: 4 }}>{value}</T>
      {sub ? <T variant="caption" style={{ fontSize: 12, marginTop: 2 }}>{sub}</T> : null}
    </View>
  );
}

function Tiles({ children }: { children: ReactNode[] }) {
  return <View style={styles.tiles}>{children}</View>;
}

export function BodyComposition({ items, profile }: { items: CompositionInput[]; profile: CompositionProfile }) {
  const all = composeAll(items, profile);
  const last = [...all].reverse().find((c) => c.weightKg != null || c.fatPct != null || c.waistToHeight != null);
  if (!last) return null;
  const change = compositionChange(items, profile);
  const lastIn = items.find((m) => m.id === last.id);

  const hints: string[] = [];
  if (!profile.sex) hints.push('Yağ oranının hesaplanması için danışan bilgilerine cinsiyet ekleyin.');
  if (!last.heightCm) hints.push('Boy girilmemiş; BKİ ve yağ oranı için en az bir ölçümde boy girin.');
  if (profile.sex && last.fatMethod !== 'device' && lastIn?.waistCm == null) hints.push('Bel ölçüsü girilince yağ oranı bel–boy formülüyle daha doğru tahmin edilir.');

  const lossSentence =
    change && change.fatKg != null && change.leanKg != null && change.fatKg + change.leanKg < 0 && change.fatKg < 0
      ? `Verilen ${n1(Math.abs(change.fatKg + change.leanKg))} kg'ın ${n1(Math.abs(change.fatKg))} kg'ı yağ${
          change.leanKg < 0 ? `, ${n1(Math.abs(change.leanKg))} kg'ı yağsız kütle` : ''
        }${change.leanKg > 0 ? `; yağsız kütle ${n1(change.leanKg)} kg arttı` : ''}.`
      : null;
  const whrLimit = profile.sex === 'FEMALE' ? '0,85' : '0,90';

  return (
    <View style={{ gap: space.lg }}>
      <View style={{ gap: space.sm }}>
        <T variant="subheading">
          Son durum <T variant="caption">· {formatDayStr(last.measuredOn, 'd MMM yyyy')}</T>
        </T>
        <Tiles>
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
                    ? `${whrLimit} ve üzeri: artmış risk`
                    : `${whrLimit} altı: hedef aralıkta`
            }
            tone={last.waistToHipRisk ? 'bad' : 'neutral'}
          />
        </Tiles>
      </View>

      {change ? (
        <View style={{ gap: space.sm }}>
          <T variant="subheading">
            İlk ölçümden bu yana{' '}
            <T variant="caption">· {formatDayStr(change.from, 'd MMM yyyy')} → {formatDayStr(change.to, 'd MMM yyyy')}</T>
          </T>
          <Tiles>
            <Tile label="Kilo" value={change.weightKg != null ? signed(change.weightKg, 'kg') : '—'} sub={change.bmi != null ? `BKİ ${signed(change.bmi, '')}` : undefined} />
            <Tile
              label="Yağ"
              value={change.fatKg != null ? signed(change.fatKg, 'kg') : '—'}
              sub={change.fatMethod ? FAT_METHOD_LABEL[change.fatMethod] : 'Aynı yöntemle iki ölçüm gerekli'}
              tone={change.fatKg == null || change.fatKg === 0 ? 'neutral' : change.fatKg < 0 ? 'good' : 'bad'}
            />
            {change.muscleKg != null ? (
              <Tile label="Kas" value={signed(change.muscleKg, 'kg')} sub={FAT_METHOD_LABEL.device} tone={change.muscleKg === 0 ? 'neutral' : change.muscleKg > 0 ? 'good' : 'bad'} />
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
          </Tiles>
          {lossSentence ? <T>{lossSentence}</T> : null}
        </View>
      ) : null}

      {hints.length ? (
        <View style={{ gap: 4 }}>
          {hints.map((h) => (
            <T key={h} variant="caption" color={colors.text}>· {h}</T>
          ))}
        </View>
      ) : null}
      <T variant="caption" style={{ fontSize: 12 }}>
        Değerler otomatik hesaplanır. Cihaz değeri girilmemişse yağ oranı formülle tahmin edilir (bel–boy: Woolcott ve Bergman 2018; BKİ–yaş: Deurenberg 1991) ve
        birkaç puan sapabilir. Mezura ile kasın kendisi değil, kası da içeren yağsız kütle tahmin edilir; kas kütlesi için vücut analizi cihazının değerini girin.
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: StyleSheet.hairlineWidth, backgroundColor: colors.line, borderRadius: radius.md, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  tile: { flexGrow: 1, flexBasis: '48%', backgroundColor: colors.surface, padding: space.md },
});
