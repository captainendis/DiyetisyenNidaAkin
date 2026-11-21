// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Site görselleri: ana sayfa kapak fotoğrafı, görüşme alanı fotoğrafı, portre (web: SiteImagesForm.tsx).
 * Fotoğraf sunucuda işlenir (döndürme düzeltmesi, konum/EXIF silme, AVIF + WebP varyantlar).
 * Önizlemeye dokunarak odak noktası seçilir; site kırparken bu noktayı korur.
 */
import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Button, Icon, Notice, T, TextField, useToast } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import type { SiteImage } from '@shared/settings';
import { colors, fonts, radius, space } from '@/theme';
import { FormSection } from './FormBits';
import { absUrl } from './ImageUpload';
import { pickImage } from './pickImage';
import { useSettingField } from './settingsStore';

type Slot = 'hero' | 'venue' | 'portrait';

/** Sitedeki yerleşik mekân fotoğrafları (web: src/config/media.ts → VENUE) */
const FALLBACK = {
  facade: { base: '/images/mekan-cephe', widths: [480, 668, 1000] },
  table: { base: '/images/mekan-masa', widths: [390, 585] },
};

const SLOTS: { key: Slot; title: string; description: string; fallback: { base: string; widths: number[] } | null; altHint: string }[] = [
  {
    key: 'hero',
    title: 'Ana sayfa kapak fotoğrafı',
    description: 'Sitenin ilk açılışında görünen büyük fotoğraf. Mekânın dış cephesi veya girişi idealdir. Panel giriş ekranında da kullanılır. Dikey ya da kare, en az 1600 piksel önerilir.',
    fallback: FALLBACK.facade,
    altHint: 'Ör. “Pelin Tek Studio Bahçekent’in akşam görünümü, cam cephe ve sıcak iç ışık”',
  },
  {
    key: 'venue',
    title: 'Görüşme alanı fotoğrafı',
    description: 'İletişim bölümünde ve randevu sayfasında görünür. Stüdyonun üst katındaki danışmanlık masasının fotoğrafı danışanların nereye geleceğini görmesine yardımcı olur.',
    fallback: FALLBACK.table,
    altHint: 'Ör. “Stüdyonun üst katındaki danışmanlık masası ve sandalyeler”',
  },
  {
    key: 'portrait',
    title: 'Portre: Nida Akın',
    description: 'Hakkımda bölümlerinde görünür. Yüklenene kadar sitede monogramlı bir yer tutucu gösterilir. Dikey (4:5) ve iyi ışıklı bir fotoğraf önerilir.',
    fallback: null,
    altHint: 'Ör. “Diyetisyen Nida Akın”',
  },
];

function ImageSlot({ slot, value, onChange, err }: { slot: (typeof SLOTS)[number]; value: SiteImage | null; onChange: (v: SiteImage | null) => void; err: (p: string) => string | undefined }) {
  const [busy, setBusy] = useState(false);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const toast = useToast();

  const choose = async () => {
    try {
      const file = await pickImage(20 * 1024 * 1024);
      if (!file) return;
      setBusy(true);
      const res = await api.upload<{ image: Omit<SiteImage, 'alt' | 'focusX' | 'focusY'> }>('/content/site-images', file);
      onChange({ ...res.image, alt: value?.alt ?? '', focusX: 50, focusY: 50 });
      toast('Fotoğraf hazırlandı. Açıklamayı yazıp “Kaydet”e dokunduğunuzda sitede görünür.', 'info');
    } catch (e) {
      toast(`Fotoğraf yüklenemedi: ${errorMessage(e)}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const preview = value
    ? `${value.base}-${value.widths.find((w) => w >= 900) ?? value.widths[value.widths.length - 1]}.webp`
    : slot.fallback
      ? `${slot.fallback.base}-${slot.fallback.widths[slot.fallback.widths.length - 1]}.webp`
      : null;

  const clamp = (n: number) => Math.min(100, Math.max(0, Math.round(n)));

  return (
    <FormSection title={slot.title} description={slot.description}>
      <Pressable
        onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
        onPress={(e) => {
          if (!value) return void (preview ? undefined : choose());
          if (!size.w || !size.h) return;
          onChange({ ...value, focusX: clamp((e.nativeEvent.locationX / size.w) * 100), focusY: clamp((e.nativeEvent.locationY / size.h) * 100) });
        }}
        accessibilityRole="button"
        accessibilityLabel={value ? 'Odak noktasını seçmek için fotoğrafa dokunun' : preview ? 'Yerleşik fotoğraf' : 'Fotoğraf seçin'}
        style={styles.frame}
      >
        {preview ? (
          <Image
            source={{ uri: absUrl(preview) }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            contentPosition={value ? { left: `${value.focusX}%`, top: `${value.focusY}%` } : 'center'}
          />
        ) : (
          <View style={{ alignItems: 'center', gap: 6, padding: space.md }}>
            <Icon name="image" size={24} color={colors.muted} />
            <T variant="label" color={colors.muted}>Fotoğraf seçin</T>
            <T variant="caption">JPG, PNG, WebP · en fazla 20 MB</T>
          </View>
        )}
        {value ? (
          <View pointerEvents="none" style={[styles.dot, { left: `${value.focusX}%`, top: `${value.focusY}%` }]} />
        ) : preview ? (
          <View style={styles.tag}>
            <T style={{ color: colors.ivory, fontFamily: fonts.semibold, fontSize: 11 }}>Yerleşik fotoğraf</T>
          </View>
        ) : null}
        {busy ? (
          <View style={styles.busy} accessibilityLiveRegion="polite">
            <ActivityIndicator color={colors.gold} />
            <T variant="label">Fotoğraf işleniyor…</T>
          </View>
        ) : null}
      </Pressable>
      {value ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name="crosshair" size={14} color={colors.muted} />
          <T variant="caption">Odak noktasını seçmek için fotoğrafa dokunun</T>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
        <Button title={value ? 'Fotoğrafı değiştir' : 'Fotoğraf yükle'} icon="upload" variant="secondary" size="sm" loading={busy} onPress={() => void choose()} />
        {value ? (
          <Button title={slot.fallback ? 'Yerleşik fotoğrafa dön' : 'Kaldır'} icon={slot.fallback ? 'rotate-ccw' : 'trash-2'} variant="ghost" size="sm" onPress={() => onChange(null)} />
        ) : null}
      </View>
      {value ? (
        <>
          <TextField
            label="Fotoğraf açıklaması"
            required
            help={`Görme engelli ziyaretçiler ve arama motorları için. ${slot.altHint}`}
            value={value.alt}
            maxLength={300}
            error={err(`${slot.key}.alt`)}
            onChange={(v) => onChange({ ...value, alt: v })}
          />
          <T variant="caption">
            {value.width}×{value.height} px · {value.widths.length} boyut hazırlandı · konum ve cihaz bilgileri silindi
          </T>
        </>
      ) : (
        <T variant="caption">{slot.fallback ? 'Şu anda sitedeki yerleşik mekân fotoğrafı kullanılıyor.' : 'Henüz portre yüklenmedi; sitede yer tutucu görünüyor.'}</T>
      )}
    </FormSection>
  );
}

export function SiteImagesForm() {
  const { d, set, err } = useSettingField('media');
  return (
    <>
      <View style={{ marginBottom: space.lg }}>
        <Notice text="Yalnızca kullanım hakkına sahip olduğunuz gerçek fotoğrafları yükleyin. Fotoğraflardaki konum (GPS) ve cihaz bilgileri yükleme sırasında otomatik silinir." />
      </View>
      {SLOTS.map((slot) => (
        <ImageSlot key={slot.key} slot={slot} value={d[slot.key]} onChange={(v) => set(slot.key, v)} err={err} />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  frame: {
    aspectRatio: 4 / 5,
    width: '100%',
    maxWidth: 320,
    alignSelf: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { position: 'absolute', width: 22, height: 22, marginLeft: -11, marginTop: -11, borderRadius: 11, borderWidth: 2, borderColor: '#fff', backgroundColor: 'rgba(33,23,16,0.25)' },
  tag: { position: 'absolute', top: 8, left: 8, borderRadius: 6, backgroundColor: 'rgba(33,23,16,0.75)', paddingHorizontal: 8, paddingVertical: 2 },
  busy: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.75)', alignItems: 'center', justifyContent: 'center', gap: space.sm },
});
