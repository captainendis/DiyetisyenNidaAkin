// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Ana sayfa içerik formları: Hero, Tanıtım, Yaklaşım, Süreç, Tarifler bölümü, Randevu çağrısı */
import { router } from 'expo-router';
import { View } from 'react-native';
import { T, TextField } from '@/components/ui';
import { colors, space } from '@/theme';
import { charCount, FormSection, Repeater } from './FormBits';
import { useSettingField } from './settingsStore';

export function HeroForm() {
  const { d, set, update, err } = useSettingField('hero');
  return (
    <>
      <FormSection title="Karşılama alanı (Hero)" description="Ziyaretçinin siteye girdiğinde ilk gördüğü başlık ve açıklama. Kısa ve net tutun.">
        <TextField label="Üst satır" help="İsteğe bağlı; boş bırakılırsa gösterilmez. Açıklamadaki bilgiyi tekrarlamayın." value={d.eyebrow} maxLength={80} error={err('eyebrow')} onChange={(v) => set('eyebrow', v)} />
        <TextField label="Başlık — 1. satır" value={d.titleLine1} maxLength={40} error={err('titleLine1')} onChange={(v) => set('titleLine1', v)} />
        <TextField label="Başlık — 2. satır" help="Pudra renginde vurgulanır" value={d.titleLine2} maxLength={40} error={err('titleLine2')} onChange={(v) => set('titleLine2', v)} />
        <TextField label="Açıklama" rows={3} value={d.description} maxLength={240} error={err('description')} help={charCount(d.description, 240)} onChange={(v) => set('description', v)} />
        <TextField label="Ana buton" help="Randevu formunu açar" value={d.primaryCta} maxLength={30} error={err('primaryCta')} onChange={(v) => set('primaryCta', v)} />
        <TextField label="İkincil bağlantı" help="Hakkımda bölümüne götürür" value={d.secondaryCta} maxLength={30} error={err('secondaryCta')} onChange={(v) => set('secondaryCta', v)} />
      </FormSection>
      <FormSection title="Öne çıkan üç özellik" description="Karşılama alanının altında simgelerle birlikte gösterilir.">
        {d.features.map((v, i) => (
          <TextField
            key={i}
            label={`Özellik ${i + 1}`}
            value={v}
            maxLength={60}
            error={err(`features.${i}`)}
            onChange={(t) => update((x) => void (x.features[i] = t), `features.${i}`)}
          />
        ))}
      </FormSection>
    </>
  );
}

export function IntroForm() {
  const { d, set, err } = useSettingField('intro');
  return (
    <FormSection title="Tanıtım bölümü" description="Karşılama alanından hemen sonra, açık zeminli bölüm. Yaklaşımınızı birkaç cümleyle anlatın.">
      <TextField label="Başlık" rows={2} value={d.heading} maxLength={160} error={err('heading')} onChange={(v) => set('heading', v)} />
      <TextField label="Metin" rows={6} value={d.body} maxLength={900} error={err('body')} help={charCount(d.body, 900)} onChange={(v) => set('body', v)} />
      <TextField label="Vurgu cümlesi" help="Metnin yanında, italik ve büyük yazılır" value={d.aside} maxLength={240} error={err('aside')} onChange={(v) => set('aside', v)} />
    </FormSection>
  );
}

export function ApproachForm() {
  const { d, set, update, err } = useSettingField('approach');
  return (
    <>
      <FormSection title="Beslenme yaklaşımı" description="Markanızı farklı kılan yaklaşım. Üç ana ilke ile anlatılır.">
        <TextField label="Başlık" value={d.heading} maxLength={120} error={err('heading')} onChange={(v) => set('heading', v)} />
        <TextField label="Alt metin" rows={2} value={d.subheading} maxLength={240} error={err('subheading')} onChange={(v) => set('subheading', v)} />
      </FormSection>
      <FormSection title="Üç ilke" description="Her ilke için kısa bir başlık ve bir-iki cümlelik açıklama.">
        {d.pillars.map((p, i) => (
          <View key={i} style={{ gap: space.md, paddingBottom: i < d.pillars.length - 1 ? space.lg : 0, borderBottomWidth: i < d.pillars.length - 1 ? 1 : 0, borderBottomColor: colors.line }}>
            <TextField label={`İlke ${i + 1}`} value={p.title} maxLength={60} error={err(`pillars.${i}.title`)} onChange={(v) => update((x) => void (x.pillars[i]!.title = v), `pillars.${i}.title`)} />
            <TextField label="Açıklama" rows={3} value={p.body} maxLength={300} error={err(`pillars.${i}.body`)} onChange={(v) => update((x) => void (x.pillars[i]!.body = v), `pillars.${i}.body`)} />
          </View>
        ))}
      </FormSection>
    </>
  );
}

export function ProcessForm() {
  const { d, set, err } = useSettingField('process');
  return (
    <FormSection title="Süreç nasıl işliyor?" description="Danışan yolculuğunun adımları. Numaralar otomatik verilir (en az 2, en fazla 6 adım).">
      <TextField label="Başlık" value={d.heading} maxLength={120} error={err('heading')} onChange={(v) => set('heading', v)} />
      <TextField label="Giriş metni" rows={2} value={d.intro} maxLength={300} error={err('intro')} onChange={(v) => set('intro', v)} />
      <Repeater
        items={d.steps}
        min={2}
        max={6}
        onChange={(steps) => set('steps', steps)}
        create={() => ({ title: '', body: '' })}
        addLabel="Adım ekle"
        itemLabel={(i) => `${String(i + 1).padStart(2, '0')} — Adım`}
        render={(s, i, upd) => (
          <>
            <TextField label="Başlık" value={s.title} maxLength={40} error={err(`steps.${i}.title`)} onChange={(v) => upd({ ...s, title: v })} />
            <TextField label="Açıklama" rows={2} value={s.body} maxLength={240} error={err(`steps.${i}.body`)} onChange={(v) => upd({ ...s, body: v })} />
          </>
        )}
      />
    </FormSection>
  );
}

export function RecipesSectionForm() {
  const { d, set, err } = useSettingField('recipesSection');
  return (
    <FormSection
      title="Tarifler bölümü"
      description={
        <T variant="caption">
          Süreç bölümünden sonra gelen tarif şeridi. Yalnızca web sitesinde yayınlanmış en az bir tarif varsa görünür; hangi tariflerin gösterileceğini{' '}
          <T variant="caption" weight="semibold" color={colors.goldInk} style={{ textDecorationLine: 'underline' }} onPress={() => router.push('/panel/tarifler')} accessibilityRole="link">
            Tarifler
          </T>{' '}
          sayfasındaki “Ana sayfada gösterilenler” bölümünden seçin.
        </T>
      }
    >
      <TextField label="Başlık" required value={d.heading} maxLength={80} error={err('heading')} onChange={(v) => set('heading', v)} />
      <TextField label="Alt metin" rows={2} value={d.intro} maxLength={240} error={err('intro')} help="Boş bırakılırsa gösterilmez." onChange={(v) => set('intro', v)} />
      <TextField label="Bağlantı metni" required value={d.linkLabel} maxLength={30} error={err('linkLabel')} help="Tarifler sayfasına giden bağlantı; toplam tarif sayısı yanına otomatik eklenir." onChange={(v) => set('linkLabel', v)} />
    </FormSection>
  );
}

export function CtaForm() {
  const { d, set, err } = useSettingField('cta');
  return (
    <FormSection title="Randevu çağrısı" description="Sayfanın altındaki koyu zeminli, ziyaretçiyi randevuya davet eden bölüm.">
      <TextField label="Başlık" rows={2} value={d.heading} maxLength={160} error={err('heading')} onChange={(v) => set('heading', v)} />
      <TextField label="Açıklama" value={d.body} maxLength={240} error={err('body')} onChange={(v) => set('body', v)} />
      <TextField label="Buton metni" value={d.button} maxLength={30} error={err('button')} onChange={(v) => set('button', v)} />
    </FormSection>
  );
}
