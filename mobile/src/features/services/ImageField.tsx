// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Görsel seçme ve yükleme: galeriden seç → /api/content/media → herkese açık URL (web: ImageUpload) */
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Icon, T, useToast } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useStaff } from '@/lib/auth';
import { API_URL } from '@/lib/config';
import { colors, radius, space } from '@/theme';

const MAX = 5 * 1024 * 1024;
export const absoluteUrl = (u: string) => (u.startsWith('/') ? `${API_URL}${u}` : u);

export function ImageField({ value, onChange, label = 'Görsel', hint }: { value: string | null; onChange: (url: string | null) => void; label?: string; hint?: string }) {
  const { can } = useStaff();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const canUpload = can('content:write');

  const pick = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return toast('Galeriye erişim izni verilmedi', 'error');
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, allowsEditing: true, aspect: [16, 9] });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    if (a.fileSize && a.fileSize > MAX) return toast('Dosya çok büyük. En fazla 5 MB yükleyebilirsiniz.', 'error');
    setBusy(true);
    try {
      const out = await api.upload<{ url: string }>('/content/media', { uri: a.uri, name: a.fileName ?? 'gorsel.jpg', type: a.mimeType ?? 'image/jpeg' });
      onChange(out.url);
      toast('Görsel yüklendi');
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 6 }}>
      <T variant="label">{label}</T>
      <View style={styles.frame}>
        {value ? (
          <Image source={{ uri: absoluteUrl(value) }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel="Seçili görsel" />
        ) : (
          <View style={styles.empty}>
            <Icon name="image" size={24} color={colors.muted} />
            <T variant="caption">JPG, PNG, WebP veya AVIF · en fazla 5 MB</T>
          </View>
        )}
      </View>
      <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center', flexWrap: 'wrap' }}>
        {canUpload ? <Button title={value ? 'Değiştir' : 'Yükle'} icon="upload" size="sm" variant="secondary" loading={busy} onPress={() => void pick()} /> : null}
        {value ? <Button title="Kaldır" icon="trash-2" size="sm" variant="ghost" onPress={() => onChange(null)} /> : null}
      </View>
      {!canUpload ? <T variant="caption">Görsel yüklemek için “Web sitesi içeriği” yetkisi gerekir.</T> : hint ? <T variant="caption">{hint}</T> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { aspectRatio: 16 / 9, borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.line, backgroundColor: '#F4EEE5', overflow: 'hidden' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.sm, padding: space.md },
});
