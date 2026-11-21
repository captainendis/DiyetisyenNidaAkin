// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Site görselleri: ana sayfa kapak fotoğrafı, görüşme alanı fotoğrafı, portre.
 * Fotoğraf sunucuda işlenir (döndürme düzeltmesi, konum/EXIF bilgisinin silinmesi, AVIF + WebP varyantlar).
 * Önizlemeye tıklayarak odak noktası seçilir; site, telefonda ve masaüstünde kırparken bu noktayı korur.
 */
import { useRef, useState } from 'react';
import { Crosshair, ImagePlus, RotateCcw, Trash2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Button, Input, useFeedback } from '@/components/panel/ui';
import type { SiteImage } from '@shared/settings';
import { VENUE } from '@/config/media';
import { cn } from '@/lib/format';
import { FormCard, FormSection, Notice, SaveBar } from './FormBits';
import { useSettingForm } from './settingsStore';

type Slot = 'hero' | 'venue' | 'portrait';

const SLOTS: { key: Slot; title: string; description: string; aspect: string; fallback: { base: string; widths: readonly number[] } | null; altHint: string }[] = [
  {
    key: 'hero',
    title: 'Ana sayfa kapak fotoğrafı',
    description: 'Sitenin ilk açılışında görünen büyük fotoğraf. Mekânın dış cephesi veya girişi idealdir. Panel giriş ekranında da kullanılır. Dikey ya da kare, en az 1600 piksel önerilir.',
    aspect: 'aspect-[4/5]',
    fallback: VENUE.facade,
    altHint: 'Ör. “Pelin Tek Studio Bahçekent’in akşam görünümü, cam cephe ve sıcak iç ışık”',
  },
  {
    key: 'venue',
    title: 'Görüşme alanı fotoğrafı',
    description: 'İletişim bölümünde ve randevu sayfasında görünür. Stüdyonun üst katındaki danışmanlık masasının fotoğrafı danışanların nereye geleceğini görmesine yardımcı olur.',
    aspect: 'aspect-[4/5]',
    fallback: VENUE.table,
    altHint: 'Ör. “Stüdyonun üst katındaki danışmanlık masası ve sandalyeler”',
  },
  {
    key: 'portrait',
    title: 'Portre (Nida Akın)',
    description: 'Hakkımda bölümlerinde görünür. Yüklenene kadar sitede monogramlı bir yer tutucu gösterilir. Dikey (4:5) ve iyi ışıklı bir fotoğraf önerilir.',
    aspect: 'aspect-[4/5]',
    fallback: null,
    altHint: 'Ör. “Diyetisyen Nida Akın”',
  },
];

function ImageSlot({
  slot, value, onChange, errors,
}: {
  slot: (typeof SLOTS)[number];
  value: SiteImage | null;
  onChange: (v: SiteImage | null) => void;
  errors: Record<string, string>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const fb = useFeedback();

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) return fb.error('Dosya çok büyük', 'En fazla 20 MB yükleyebilirsiniz.');
    const form = new FormData();
    form.append('file', file);
    setBusy(true);
    try {
      const res = await api.upload<{ image: Omit<SiteImage, 'alt' | 'focusX' | 'focusY'> }>('/content/site-images', form);
      onChange({ ...res.image, alt: value?.alt ?? '', focusX: 50, focusY: 50 });
      fb.success('Fotoğraf hazırlandı', 'Açıklamayı yazıp “Kaydet”e bastığınızda sitede görünür.');
    } catch (e) {
      fb.error('Fotoğraf yüklenemedi', e instanceof ApiError ? e.message : undefined);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  const preview = value
    ? `${value.base}-${value.widths.find((w) => w >= 900) ?? value.widths[value.widths.length - 1]}.webp`
    : slot.fallback
      ? `${slot.fallback.base}-${slot.fallback.widths[slot.fallback.widths.length - 1]}.webp`
      : null;

  const pickFocus = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!value) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - r.left) / r.width) * 100);
    const y = Math.round(((e.clientY - r.top) / r.height) * 100);
    onChange({ ...value, focusX: Math.min(100, Math.max(0, x)), focusY: Math.min(100, Math.max(0, y)) });
  };

  return (
    <FormSection title={slot.title} description={slot.description}>
      <div className="grid gap-5 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
        <div>
          <div className={cn('relative overflow-hidden rounded-lg border border-panel-line bg-panel-bg', slot.aspect)}>
            {preview ? (
              <button
                type="button"
                onClick={pickFocus}
                disabled={!value}
                className={cn('group block h-full w-full', value && 'cursor-crosshair')}
                aria-label={value ? 'Odak noktasını seçmek için fotoğrafa tıklayın' : 'Yerleşik fotoğraf'}
              >
                <img
                  src={preview}
                  alt=""
                  className="h-full w-full object-cover"
                  style={value ? { objectPosition: `${value.focusX}% ${value.focusY}%` } : undefined}
                />
                {value && (
                  <span
                    className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.4)]"
                    style={{ left: `${value.focusX}%`, top: `${value.focusY}%` }}
                    aria-hidden
                  />
                )}
              </button>
            ) : (
              <button type="button" onClick={() => input.current?.click()} className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center text-panel-muted hover:text-cocoa">
                <ImagePlus className="h-6 w-6" />
                <span className="text-[0.8rem] font-medium">Fotoğraf seçin</span>
                <span className="text-[0.72rem]">JPG, PNG, WebP · en fazla 20 MB</span>
              </button>
            )}
            {!value && preview && (
              <span className="absolute top-2 left-2 rounded bg-espresso/75 px-2 py-0.5 text-[0.68rem] font-semibold text-ivory">Yerleşik fotoğraf</span>
            )}
            {busy && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-[0.8rem] font-semibold text-cocoa" aria-live="polite">
                Fotoğraf işleniyor…
              </div>
            )}
          </div>
          {value && (
            <p className="mt-2 flex items-center gap-1.5 text-[0.72rem] text-panel-muted">
              <Crosshair className="h-3.5 w-3.5" /> Odak noktasını seçmek için fotoğrafa tıklayın
            </p>
          )}
        </div>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" loading={busy} icon={<ImagePlus className="h-4 w-4" />} onClick={() => input.current?.click()}>
              {value ? 'Fotoğrafı değiştir' : 'Fotoğraf yükle'}
            </Button>
            {value && (
              <Button variant="ghost" size="sm" icon={slot.fallback ? <RotateCcw className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />} onClick={() => onChange(null)}>
                {slot.fallback ? 'Yerleşik fotoğrafa dön' : 'Kaldır'}
              </Button>
            )}
          </div>
          {value ? (
            <Input
              label="Fotoğraf açıklaması"
              required
              hint={`Görme engelli ziyaretçiler ve arama motorları için. ${slot.altHint}`}
              value={value.alt}
              maxLength={300}
              error={errors[`${slot.key}.alt`]}
              onChange={(e) => onChange({ ...value, alt: e.target.value })}
            />
          ) : (
            <p className="text-[0.8rem] leading-relaxed text-panel-muted">
              {slot.fallback
                ? 'Şu anda sitedeki yerleşik mekân fotoğrafı kullanılıyor.'
                : 'Henüz portre yüklenmedi; sitede yer tutucu görünüyor.'}
            </p>
          )}
          {value && (
            <p className="text-[0.75rem] text-panel-muted">
              {value.width}×{value.height} px · {value.widths.length} boyut hazırlandı · konum ve cihaz bilgileri silindi
            </p>
          )}
        </div>
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" tabIndex={-1} onChange={(e) => void onFile(e.target.files?.[0])} />
    </FormSection>
  );
}

export function SiteImagesForm() {
  const f = useSettingForm('media', { successMessage: 'Görseller kaydedildi' });
  if (!f.draft) return null;
  const d = f.draft;
  return (
    <FormCard>
      <Notice className="mx-5 mt-5 sm:mx-6">
        Yalnızca kullanım hakkına sahip olduğunuz gerçek fotoğrafları yükleyin. Fotoğraflardaki konum (GPS) ve cihaz bilgileri yükleme sırasında otomatik silinir.
      </Notice>
      {SLOTS.map((slot) => (
        <ImageSlot key={slot.key} slot={slot} value={d[slot.key]} onChange={(v) => f.set(slot.key, v)} errors={f.errors} />
      ))}
      <SaveBar dirty={f.dirty} saving={f.saving} onSave={() => void f.save()} onReset={f.reset} viewHref="/" />
    </FormCard>
  );
}
