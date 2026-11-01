// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Button, Input, Modal, Switch, Textarea, useFeedback } from '@/components/panel/ui';
import { ServiceIcon, SERVICE_ICON_LABEL } from '@/components/icons/ServiceIcon';
import { SERVICE_ICONS } from '@shared/constants';
import { cn, slugify } from '@/lib/format';
import { CharCount } from '@/components/panel/content/FormBits';
import { ImageUpload } from '@/components/panel/content/ImageUpload';
import { ServicePreviewCard } from './ServicePreviewCard';
import type { Service } from './types';

interface Form {
  title: string;
  slug: string;
  summary: string;
  description: string;
  icon: string;
  imageUrl: string | null;
  isPublished: boolean;
  duration: string;
  price: string;
  showPrice: boolean;
}

const toForm = (s: Service | null): Form => ({
  title: s?.title ?? '',
  slug: s?.slug ?? '',
  summary: s?.summary ?? '',
  description: s?.description ?? '',
  icon: s?.icon ?? 'leaf',
  imageUrl: s?.imageUrl ?? null,
  isPublished: s?.isPublished ?? false,
  duration: s?.durationMinutes ? String(s.durationMinutes) : '',
  price: s?.priceCents != null ? String(s.priceCents / 100) : '',
  showPrice: s?.showPrice ?? false,
});

export function ServiceFormModal({ open, service, index, onClose, onSaved }: { open: boolean; service: Service | null; index: number; onClose: () => void; onSaved: (s: Service) => void }) {
  const fb = useFeedback();
  const [f, setF] = useState<Form>(() => toForm(service));
  const [slugTouched, setSlugTouched] = useState(!!service);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setF(toForm(service));
      setSlugTouched(!!service);
      setErrors({});
    }
  }, [open, service]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setF((x) => ({ ...x, [k]: v, ...(k === 'title' && !slugTouched ? { slug: slugify(String(v)) } : {}) }));
    setErrors((e) => ({ ...e, [k === 'duration' ? 'durationMinutes' : k === 'price' ? 'priceCents' : k]: '' }));
  };

  const priceNum = f.price.trim() === '' ? null : Number(f.price.replace(',', '.'));
  const save = async () => {
    const local: Record<string, string> = {};
    if (f.duration && (!/^\d+$/.test(f.duration) || +f.duration < 10 || +f.duration > 240)) local.durationMinutes = '10–240 dakika arasında bir sayı girin';
    if (priceNum !== null && (Number.isNaN(priceNum) || priceNum < 0)) local.priceCents = 'Geçerli bir tutar girin';
    if (f.showPrice && priceNum === null) local.priceCents = 'Ücreti göstermek için bir tutar girin';
    if (Object.keys(local).length) return setErrors(local);
    setSaving(true);
    try {
      const body = {
        title: f.title,
        slug: f.slug || undefined,
        summary: f.summary,
        description: f.description,
        icon: f.icon,
        imageUrl: f.imageUrl,
        isPublished: f.isPublished,
        durationMinutes: f.duration ? Number(f.duration) : null,
        priceCents: priceNum === null ? null : Math.round(priceNum * 100),
        showPrice: f.showPrice,
      };
      const res = service ? await api.patch<{ item: Service }>(`/services/${service.id}`, body) : await api.post<{ item: Service }>('/services', body);
      fb.success(service ? 'Hizmet güncellendi' : 'Hizmet eklendi', f.isPublished ? 'Web sitesinde görünür.' : 'Yayında değil — yalnızca panelde görünür.');
      onSaved(res.item);
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) setErrors(e.fields);
      else fb.error('Kaydedilemedi', e instanceof ApiError ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={service ? 'Hizmeti düzenle' : 'Yeni hizmet'}
      description="Bu hizmet, yayındaysa ana sayfada ve Hizmetler sayfasında gösterilir."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Vazgeç</Button>
          <Button onClick={() => void save()} loading={saving}>Kaydet</Button>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-4">
          <Input label="Başlık" required value={f.title} maxLength={120} error={errors.title} onChange={(e) => set('title', e.target.value)} />
          <Input
            label="Adres (URL)"
            hint={<span className="font-mono">/hizmetler/{f.slug || '…'}</span>}
            value={f.slug}
            error={errors.slug}
            onChange={(e) => {
              setSlugTouched(true);
              set('slug', slugify(e.target.value));
            }}
          />
          <Textarea label="Kısa açıklama" required rows={2} maxLength={300} value={f.summary} error={errors.summary} hint={<CharCount value={f.summary} max={300} />} onChange={(e) => set('summary', e.target.value)} />
          <Textarea label="Detaylı açıklama" rows={5} maxLength={4000} value={f.description} error={errors.description} hint="Hizmet detay sayfasında gösterilir." onChange={(e) => set('description', e.target.value)} />

          <fieldset>
            <legend className="mb-2 text-[0.8rem] font-semibold text-cocoa">Simge</legend>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-8" role="radiogroup" aria-label="Simge seçimi">
              {SERVICE_ICONS.map((key) => (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={f.icon === key}
                  title={SERVICE_ICON_LABEL[key]}
                  onClick={() => set('icon', key)}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-lg border p-2 transition-colors',
                    f.icon === key ? 'border-cocoa bg-cocoa text-rose' : 'border-panel-line bg-white text-cocoa hover:border-cocoa/40',
                  )}
                >
                  <ServiceIcon name={key} className="h-7 w-7" />
                  <span className={cn('text-[0.65rem] font-medium', f.icon === key ? 'text-ivory' : 'text-panel-muted')}>{SERVICE_ICON_LABEL[key]}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Görüşme süresi (dk)" inputMode="numeric" placeholder="Ör. 45" hint="Boşsa çalışma takvimindeki varsayılan süre kullanılır." value={f.duration} error={errors.durationMinutes} onChange={(e) => set('duration', e.target.value.replace(/\D/g, ''))} />
            <Input label="Ücret (₺) — isteğe bağlı" inputMode="decimal" placeholder="Boş bırakılabilir" value={f.price} error={errors.priceCents} onChange={(e) => set('price', e.target.value.replace(/[^\d.,]/g, ''))} />
          </div>
          <div className="space-y-3 rounded-lg border border-panel-line p-4">
            <Switch checked={f.showPrice} onChange={(v) => set('showPrice', v)} label="Ücreti web sitesinde göster" description="Kapalıysa ücret yalnızca panelde saklanır." />
            <Switch checked={f.isPublished} onChange={(v) => set('isPublished', v)} label="Web sitesinde yayınla" />
          </div>
          <ImageUpload value={f.imageUrl} onChange={(v) => set('imageUrl', v)} label="Görsel (isteğe bağlı)" hint="Hizmet detay sayfasında kullanılır." />
        </div>
        <div className="lg:sticky lg:top-0 lg:self-start">
          <p className="mb-2 text-[0.72rem] font-semibold tracking-[0.12em] text-panel-muted uppercase">Sitedeki görünüm</p>
          <ServicePreviewCard title={f.title} summary={f.summary} icon={f.icon} durationMinutes={f.duration ? Number(f.duration) : null} priceCents={priceNum === null || Number.isNaN(priceNum) ? null : priceNum * 100} showPrice={f.showPrice} index={index} />
        </div>
      </div>
    </Modal>
  );
}
