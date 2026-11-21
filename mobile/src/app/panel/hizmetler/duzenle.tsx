// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Hizmet ekle / düzenle (?id=…): başlık, adres, açıklamalar, simge, süre, ücret, yayın, görsel + site önizlemesi. Web: ServiceFormModal */
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Card, Empty, Form, Notice, QueryView, Screen, Section, SwitchField, T, TextField, useToast } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useStaff } from '@/lib/auth';
import { slugify } from '@/lib/format';
import { queryClient, useApiQuery } from '@/lib/query';
import { colors, fonts, radius, space } from '@/theme';
import { SERVICE_ICONS } from '@shared/constants';
import { ImageField } from '@/features/services/ImageField';
import { ServiceIcon, SERVICE_ICON_LABEL } from '@/features/services/ServiceIcon';
import { ServicePreviewCard } from '@/features/services/ServicePreviewCard';
import { serviceKeys, type Service } from '@/features/services/types';

export default function ServiceFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { can } = useStaff();
  const allowed = can('services:write');
  const q = useApiQuery(serviceKeys.list, () => api.get<{ items: Service[] }>('/services'), { enabled: allowed });
  const title = id ? 'Hizmeti düzenle' : 'Yeni hizmet';
  if (!allowed) {
    return (
      <Screen>
        <Stack.Screen options={{ title }} />
        <Empty icon="lock" title="Erişim yok" text="Hizmetleri yönetme yetkiniz bulunmuyor." />
      </Screen>
    );
  }
  return (
    <>
      <Stack.Screen options={{ title }} />
      <QueryView query={q}>
        {({ items }) => {
          const service = id ? items.find((s) => s.id === id) : null;
          if (id && !service) return <Empty icon="alert-circle" title="Hizmet bulunamadı" text="Silinmiş olabilir. Hizmetler listesine dönüp yeniden seçin." />;
          return <ServiceForm service={service ?? null} index={service ? items.indexOf(service) : items.length} />;
        }}
      </QueryView>
    </>
  );
}

interface F {
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

const toForm = (s: Service | null): F => ({
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

function ServiceForm({ service, index }: { service: Service | null; index: number }) {
  const toast = useToast();
  const [f, setF] = useState<F>(() => toForm(service));
  const [slugTouched, setSlugTouched] = useState(!!service);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof F>(k: K, v: F[K]) => {
    setF((x) => ({ ...x, [k]: v, ...(k === 'title' && !slugTouched ? { slug: slugify(String(v)) } : {}) }));
    setErrors((e) => ({ ...e, [k === 'duration' ? 'durationMinutes' : k === 'price' ? 'priceCents' : k]: '' }));
  };

  const priceNum = f.price.trim() === '' ? null : Number(f.price.replace(',', '.'));

  const save = async () => {
    const local: Record<string, string> = {};
    if (f.duration && (!/^\d+$/.test(f.duration) || +f.duration < 10 || +f.duration > 240)) local.durationMinutes = '10–240 dakika arasında bir sayı girin';
    if (priceNum !== null && (Number.isNaN(priceNum) || priceNum < 0)) local.priceCents = 'Geçerli bir tutar girin';
    if (f.showPrice && priceNum === null) local.priceCents = 'Ücreti göstermek için bir tutar girin';
    setError('');
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
      if (service) await api.patch<{ item: Service }>(`/services/${service.id}`, body);
      else await api.post<{ item: Service }>('/services', body);
      toast(`${service ? 'Hizmet güncellendi' : 'Hizmet eklendi'} · ${f.isPublished ? 'Web sitesinde görünür.' : 'Yayında değil, yalnızca panelde görünür.'}`);
      await queryClient.invalidateQueries({ queryKey: serviceKeys.list });
      router.back();
    } catch (e) {
      const fields = (e as { status?: number; fields?: Record<string, string> }).fields ?? {};
      if (Object.keys(fields).length) setErrors(fields);
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen footer={<Button title="Kaydet" full onPress={() => void save()} loading={saving} />}>
      <Form>
        <T variant="caption">Bu hizmet, yayındaysa ana sayfada ve Hizmetler sayfasında gösterilir.</T>
        {error ? <Notice tone="danger" title="Kaydedilemedi" text={error} /> : null}
        <TextField label="Başlık" required value={f.title} maxLength={120} error={errors.title} onChange={(v) => set('title', v)} />
        <TextField
          label="Adres (URL)"
          value={f.slug}
          error={errors.slug}
          autoCapitalize="none"
          autoCorrect={false}
          help={`/hizmetler/${f.slug || '…'}`}
          onChange={(v) => {
            setSlugTouched(true);
            set('slug', slugify(v));
          }}
        />
        <TextField label="Kısa açıklama" required rows={2} maxLength={300} value={f.summary} error={errors.summary} help={`${f.summary.length}/300`} onChange={(v) => set('summary', v)} />
        <TextField label="Detaylı açıklama" rows={6} maxLength={4000} value={f.description} error={errors.description} help="Hizmet detay sayfasında gösterilir." onChange={(v) => set('description', v)} />

        <View style={{ gap: 6 }}>
          <T variant="label">Simge</T>
          <View style={styles.icons} accessibilityRole="radiogroup" accessibilityLabel="Simge seçimi">
            {SERVICE_ICONS.map((key) => {
              const on = f.icon === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => set('icon', key)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={SERVICE_ICON_LABEL[key]}
                  style={[styles.icon, on && styles.iconOn]}
                >
                  <ServiceIcon name={key} size={24} color={on ? colors.rose : colors.cocoa} />
                  <T style={{ fontFamily: fonts.medium, fontSize: 11, color: on ? colors.ivory : colors.muted }}>{SERVICE_ICON_LABEL[key]}</T>
                </Pressable>
              );
            })}
          </View>
          {errors.icon ? <T variant="caption" color={colors.dangerInk}>{errors.icon}</T> : null}
        </View>

        <TextField
          label="Görüşme süresi (dk)"
          keyboardType="number-pad"
          placeholder="Ör. 45"
          help="Boşsa çalışma takvimindeki varsayılan süre kullanılır."
          value={f.duration}
          error={errors.durationMinutes}
          maxLength={3}
          onChange={(v) => set('duration', v.replace(/\D/g, ''))}
        />
        <TextField
          label="Ücret (₺, isteğe bağlı)"
          keyboardType="decimal-pad"
          placeholder="Boş bırakılabilir"
          value={f.price}
          error={errors.priceCents}
          onChange={(v) => set('price', v.replace(/[^\d.,]/g, ''))}
        />
        <Card style={{ gap: space.sm }}>
          <SwitchField label="Ücreti web sitesinde göster" help="Kapalıysa ücret yalnızca panelde saklanır." value={f.showPrice} onChange={(v) => set('showPrice', v)} />
          <SwitchField label="Web sitesinde yayınla" value={f.isPublished} onChange={(v) => set('isPublished', v)} />
        </Card>
        <ImageField value={f.imageUrl} onChange={(v) => set('imageUrl', v)} label="Görsel (isteğe bağlı)" hint="Hizmet detay sayfasında kullanılır." />

        <Section title="Sitedeki görünüm" style={{ marginBottom: 0 }}>
          <ServicePreviewCard
            title={f.title}
            summary={f.summary}
            icon={f.icon}
            durationMinutes={f.duration ? Number(f.duration) : null}
            priceCents={priceNum === null || Number.isNaN(priceNum) ? null : priceNum * 100}
            showPrice={f.showPrice}
            index={index}
          />
        </Section>
      </Form>
    </Screen>
  );
}

const styles = StyleSheet.create({
  icons: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  icon: {
    width: '23%',
    flexGrow: 1,
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingVertical: space.sm,
  },
  iconOn: { backgroundColor: colors.cocoa, borderColor: colors.cocoa },
});
