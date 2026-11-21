// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * "Siteyi tamamlayın" — yayın öncesi panelden doldurulması gereken bilgiler (GET /api/dashboard/setup).
 * Web bağlantıları mobil ekranlara eşlenir.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Icon, ListItem, ProgressBar, T } from '@/components/ui';
import { api } from '@/lib/api';
import { useApiQuery } from '@/lib/query';
import { colors, space } from '@/theme';
import type { SetupItem } from './types';

/** Web panel adresi → mobil ekran */
function mobileHref(href: string): string {
  const [path, qs = ''] = href.split('?');
  const tab = /(?:^|&)sekme=([^&]+)/.exec(qs)?.[1];
  if (path === '/panel/ayarlar/takvim') return '/panel/takvim';
  if (path === '/panel/icerikler') {
    if (tab === 'blog') return '/panel/blog';
    if (tab === 'iletisim' || tab === 'gorseller' || tab === 'hakkimda') return `/panel/icerik/${tab}`;
    return '/panel/icerik';
  }
  return path ?? '/panel';
}

export function SetupChecklist() {
  const q = useApiQuery(['dashboard', 'setup'], () => api.get<{ items: SetupItem[]; done: number; total: number }>('/dashboard/setup'));
  const [showDone, setShowDone] = useState(false);
  const data = q.data;
  if (!data || data.done === data.total) return null;
  const pending = data.items.filter((i) => !i.done);
  const done = data.items.filter((i) => i.done);
  return (
    <Card padded={false} style={{ overflow: 'hidden', marginBottom: space.xl }}>
      <View style={{ padding: space.lg, gap: space.sm }}>
        <T variant="heading">Siteyi tamamlayın</T>
        <T variant="caption">Bu bilgiler girildikçe web sitesindeki “Yakında eklenecek” alanları kendiliğinden dolar.</T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <View style={{ flex: 1 }}>
            <ProgressBar value={(data.done / data.total) * 100} color={colors.success} />
          </View>
          <T variant="label">{data.done}/{data.total}</T>
        </View>
      </View>
      <View style={{ borderTopWidth: 1, borderTopColor: colors.line }}>
        {pending.map((i, idx) => (
          <ListItem
            key={i.key}
            left={<View style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, borderColor: colors.mist }} />}
            title={
              <View style={{ gap: 1 }}>
                <T variant="overline" color={colors.muted}>{i.group}</T>
                <T variant="subheading">{i.label}</T>
              </View>
            }
            subtitle={i.hint}
            last={idx === pending.length - 1 && !done.length}
            onPress={() => router.push(mobileHref(i.href))}
          />
        ))}
      </View>
      {done.length ? (
        <View style={{ padding: space.md, gap: space.sm }}>
          <Button title={`Tamamlananlar (${done.length})`} icon={showDone ? 'chevron-down' : 'chevron-right'} variant="ghost" size="sm" style={{ alignSelf: 'flex-start' }} onPress={() => setShowDone((v) => !v)} />
          {showDone
            ? done.map((i) => (
                <View key={i.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.sm }}>
                  <Icon name="check" size={14} color={colors.successInk} />
                  <T variant="caption">{i.label}</T>
                </View>
              ))
            : null}
        </View>
      ) : null}
    </Card>
  );
}
