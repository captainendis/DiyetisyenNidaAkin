// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** İçerik/ayar formları için ortak parçalar (web: src/components/panel/content/FormBits.tsx, Repeater.tsx) */
import { usePreventRemove } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { Button, Card, confirm, IconButton, T } from '@/components/ui';
import { SITE_URL } from '@/lib/config';
import { colors, radius, space } from '@/theme';

/** Başlık + açıklamalı form kartı */
export function FormSection({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <Card style={{ marginBottom: space.lg }}>
      <View style={{ gap: 4, marginBottom: space.lg }}>
        <T variant="heading">{title}</T>
        {description ? typeof description === 'string' ? <T variant="caption">{description}</T> : description : null}
      </View>
      <View style={{ gap: space.lg }}>{children}</View>
    </Card>
  );
}

/** Ekranın altında sabit kaydet çubuğu (Screen `footer`) */
export function SaveBar({ dirty, saving, onSave, onReset, note, saveLabel = 'Kaydet' }: { dirty: boolean; saving: boolean; onSave: () => void; onReset: () => void; note?: string; saveLabel?: string }) {
  return (
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
      <T variant="caption" style={{ flex: 1 }} color={dirty ? colors.warningInk : colors.muted} weight={dirty ? 'semibold' : undefined} accessibilityLiveRegion="polite">
        {dirty ? 'Kaydedilmemiş değişiklikler var' : note ?? 'Tüm değişiklikler kaydedildi'}
      </T>
      {dirty ? <Button title="Vazgeç" variant="ghost" size="sm" onPress={onReset} disabled={saving} /> : null}
      <Button title={saveLabel} size="sm" onPress={onSave} loading={saving} disabled={!dirty} />
    </View>
  );
}

/** "12/240" karakter sayacı (alan yardım metni) */
export function charCount(value: string | null | undefined, max: number) {
  return `${value?.length ?? 0}/${max}`;
}

/** Boş metni null'a çevirir (isteğe bağlı alanlar) */
export const nullIfEmpty = (v: string) => (v.trim() === '' ? null : v);

/** Kaydedilmemiş değişiklik varken geri gitmeyi onaya bağlar. Dönen fonksiyon korumayı kapatır. */
export function useUnsavedGuard(active: boolean) {
  return usePreventRemove(active, ({ repeat }) => {
    void confirm({ title: 'Kaydedilmemiş değişiklikler', message: 'Ayrılırsanız yaptığınız değişiklikler kaybolacak.', confirmText: 'Ayrıl', destructive: true }).then((ok) => {
      if (ok) repeat();
    });
  });
}

/** Web sitesindeki sayfayı uygulama içi tarayıcıda açar */
export function openSite(path: string) {
  void WebBrowser.openBrowserAsync(SITE_URL + path);
}

/** Başlık çubuğu: "Sitede görüntüle" */
export function ViewOnSiteButton({ path }: { path: string }) {
  return <IconButton name="external-link" label="Sitede görüntüle" onPress={() => openSite(path)} />;
}

/** Sıralanabilir tekrar eden alan listesi (paragraflar, ilkeler, adımlar, belgeler) */
export function Repeater<I>({
  items,
  onChange,
  render,
  create,
  max,
  min = 0,
  addLabel,
  itemLabel,
  empty,
}: {
  items: I[];
  onChange: (items: I[]) => void;
  render: (item: I, index: number, update: (v: I) => void) => ReactNode;
  create: () => I;
  max?: number;
  min?: number;
  addLabel: string;
  itemLabel: (i: number) => string;
  empty?: ReactNode;
}) {
  const move = (i: number, d: -1 | 1) => {
    const next = [...items];
    const [x] = next.splice(i, 1);
    next.splice(i + d, 0, x!);
    onChange(next);
  };
  return (
    <View style={{ gap: space.md }}>
      {items.length === 0 ? empty : null}
      {items.map((item, i) => (
        <View key={i} style={{ borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.bg, padding: space.md, gap: space.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <T variant="overline" style={{ flex: 1 }} color={colors.muted}>{itemLabel(i)}</T>
            {i > 0 ? <IconButton name="arrow-up" label="Yukarı taşı" onPress={() => move(i, -1)} /> : null}
            {i < items.length - 1 ? <IconButton name="arrow-down" label="Aşağı taşı" onPress={() => move(i, 1)} /> : null}
            {items.length > min ? <IconButton name="trash-2" label="Kaldır" color={colors.dangerInk} onPress={() => onChange(items.filter((_, j) => j !== i))} /> : null}
          </View>
          {render(item, i, (v) => onChange(items.map((x, j) => (j === i ? v : x))))}
        </View>
      ))}
      {max === undefined || items.length < max ? (
        <Button title={addLabel} icon="plus" variant="secondary" size="sm" style={{ alignSelf: 'flex-start' }} onPress={() => onChange([...items, create()])} />
      ) : null}
    </View>
  );
}

/** Gecikmeli değer (arama kutuları) */
export function useDebounced<V>(value: V, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Sayfalama: ‹ 2 / 5 › */
export function Pager({ page, pageSize, total, onChange }: { page: number; pageSize: number; total: number; onChange: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.md, marginTop: space.lg }}>
      <Button title="Önceki" icon="chevron-left" variant="secondary" size="sm" disabled={page <= 1} onPress={() => onChange(page - 1)} />
      <T variant="label" accessibilityLabel={`Sayfa ${page} / ${pages}`}>{page} / {pages}</T>
      <Button title="Sonraki" variant="secondary" size="sm" disabled={page >= pages} onPress={() => onChange(page + 1)} />
    </View>
  );
}
