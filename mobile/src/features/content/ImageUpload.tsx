// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Görsel yükleme: POST /api/content/media → herkese açık URL. Dosya türü sunucuda içerikten doğrulanır. */
import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Button, Icon, T, useToast } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { API_URL } from '@/lib/config';
import { colors, radius, space } from '@/theme';
import { pickImage } from './pickImage';

export const absUrl = (u: string) => (/^https?:\/\//.test(u) ? u : API_URL + u);

export function ImageUpload({ value, onChange, label = 'Görsel', alt }: { value: string | null | undefined; onChange: (url: string | null) => void; label?: string; alt?: string | null }) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const choose = async () => {
    try {
      const file = await pickImage(5 * 1024 * 1024);
      if (!file) return;
      setBusy(true);
      const res = await api.upload<{ url: string }>('/content/media', file, alt?.trim() ? { alt: alt.trim() } : {});
      onChange(res.url);
      toast('Görsel yüklendi');
    } catch (e) {
      toast(`Görsel yüklenemedi: ${errorMessage(e)}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: space.sm }}>
      <T variant="label">{label}</T>
      <Pressable
        onPress={value ? undefined : () => void choose()}
        disabled={!!value || busy}
        accessibilityRole={value ? 'image' : 'button'}
        accessibilityLabel={value ? label : 'Görsel seçin'}
        style={{ aspectRatio: 16 / 9, borderRadius: radius.md, borderWidth: 1, borderStyle: value ? 'solid' : 'dashed', borderColor: colors.line, backgroundColor: colors.bg, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}
      >
        {value ? (
          <Image source={{ uri: absUrl(value) }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
        ) : (
          <View style={{ alignItems: 'center', gap: 6, padding: space.md }}>
            <Icon name="image" size={24} color={colors.muted} />
            <T variant="label" color={colors.muted}>Görsel seçin</T>
            <T variant="caption">JPG, PNG, WebP veya AVIF · en fazla 5 MB</T>
          </View>
        )}
        {busy ? (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center' }]}>
            <ActivityIndicator color={colors.gold} />
          </View>
        ) : null}
      </Pressable>
      <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
        <Button title={value ? 'Değiştir' : 'Yükle'} icon="upload" variant="secondary" size="sm" loading={busy} onPress={() => void choose()} />
        {value ? <Button title="Kaldır" icon="trash-2" variant="ghost" size="sm" onPress={() => onChange(null)} /> : null}
      </View>
    </View>
  );
}
