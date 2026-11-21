// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Dosyalar (web: PortalFilesPage) — diyetisyenin paylaştığı belgeler; dokununca indirilir ve paylaşım sayfası açılır */
import { Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator } from 'react-native';
import type { PortalFile } from '@shared/portal';
import { Card, Empty, Icon, ListItem, QueryView, Screen, T, useToast } from '@/components/ui';
import { PK, fileSize } from '@/features/portal/util';
import { errorMessage, portalApi } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { useApiQuery } from '@/lib/query';
import { colors, space } from '@/theme';

export default function FilesScreen() {
  const q = useApiQuery(PK.files, () => portalApi.get<{ items: PortalFile[] }>('/files'));
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const download = async (f: PortalFile) => {
    if (busy) return;
    setBusy(f.id);
    try {
      await portalApi.download(`/files/${f.id}/download`, f.originalName);
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen refreshing={q.refreshing} onRefresh={q.refresh}>
      <Stack.Screen options={{ title: 'Dosyalar' }} />
      <T muted style={{ marginBottom: space.lg }}>Diyetisyeninin seninle paylaştığı belgeler.</T>
      <QueryView query={q}>
        {(data) =>
          !data.items.length ? (
            <Empty icon="paperclip" title="Paylaşılan dosya yok." text="Diyetisyenin seninle bir belge (ör. tahlil sonucu) paylaştığında buradan indirebilirsin." />
          ) : (
            <Card padded={false}>
              {data.items.map((f, i) => (
                <ListItem
                  key={f.id}
                  icon={f.mimeType === 'application/pdf' ? 'file-text' : f.mimeType.startsWith('image/') ? 'image' : 'file'}
                  title={f.originalName}
                  subtitle={`${fileSize(f.sizeBytes)} · ${formatDate(f.createdAt)}`}
                  right={busy === f.id ? <ActivityIndicator color={colors.gold} /> : <Icon name="download" size={18} color={colors.cocoa} />}
                  last={i === data.items.length - 1}
                  onPress={() => void download(f)}
                />
              ))}
            </Card>
          )
        }
      </QueryView>
    </Screen>
  );
}
