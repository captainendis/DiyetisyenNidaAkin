// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Listelerim (web: PortalPlansPage) — verilen beslenme listeleri, en yenisi en üstte */
import { router } from 'expo-router';
import { View } from 'react-native';
import type { PortalPlanListItem } from '@shared/portal';
import { Badge, Button, Card, Empty, QueryView, Screen, T } from '@/components/ui';
import { usePlanPdf } from '@/features/portal/usePlanPdf';
import { PK } from '@/features/portal/util';
import { portalApi } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { useApiQuery } from '@/lib/query';
import { space } from '@/theme';

export default function PlansTab() {
  const q = useApiQuery(PK.plans, () => portalApi.get<{ items: PortalPlanListItem[] }>('/plans'));
  const pdf = usePlanPdf();
  return (
    <Screen refreshing={q.refreshing} onRefresh={q.refresh}>
      <T muted style={{ marginBottom: space.lg }}>Sana verilen beslenme listeleri, en yenisi en üstte. Her öğünde seçeneklerden yalnızca birini seç.</T>
      <QueryView query={q}>
        {(data) =>
          !data.items.length ? (
            <Empty icon="clipboard" title="Henüz listen yok." text="Görüşmeden sonra beslenme listen burada görünecek." />
          ) : (
            <View style={{ gap: space.md }}>
              {data.items.map((p, i) => (
                <Card key={p.id} onPress={() => router.push(`/hesabim/listeler/${p.id}`)}>
                  <View style={{ gap: 4 }}>
                    {i === 0 ? <Badge label="Güncel" tone="gold" /> : null}
                    <T variant="title" style={{ fontSize: 24, lineHeight: 28 }}>{p.name}</T>
                    <T variant="caption">{formatDate(p.createdAt)} tarihinde verildi</T>
                  </View>
                  <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
                    <Button title="Aç" size="sm" icon="book-open" onPress={() => router.push(`/hesabim/listeler/${p.id}`)} />
                    <Button title="PDF olarak paylaş" size="sm" variant="secondary" icon="share" loading={pdf.busyId === p.id} onPress={() => void pdf.share(p.id, p.name)} />
                  </View>
                </Card>
              ))}
            </View>
          )
        }
      </QueryView>
    </Screen>
  );
}
