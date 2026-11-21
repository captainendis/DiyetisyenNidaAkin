// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Danışan detayı → Beslenme Planları (web: ClientPlansTab) */
import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Button, Card, Empty, Icon, IconButton, ListItem, QueryView, Section, T, useToast } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useApiQuery } from '@/lib/query';
import { RECIPE_CATEGORY_LABEL, type Recipe } from '@shared/recipe';
import { colors, space } from '@/theme';
import { clientKeys, type PlanListItem } from './types';

/** Danışana özel tarif varyasyonları (yalnızca listeleme; düzenleme Tarifler bölümünde) */
function ClientRecipes({ clientId }: { clientId: string }) {
  const q = useApiQuery(['recipes', 'client', clientId], () => api.get<{ items: Recipe[] }>('/recipes', { clientId }));
  const items = q.data?.items ?? [];
  return (
    <Section title="Kişiye özel tarifler" style={{ marginBottom: space.sm }} action={<Button title="Tümünü yönet" variant="ghost" size="sm" onPress={() => router.push('/panel/tarifler')} />}>
      <T variant="caption" style={{ marginBottom: space.sm, paddingHorizontal: 2 }}>Bu danışan için uyarlanmış tarif varyasyonları. Web sitesinde yayınlanmazlar.</T>
      {!items.length ? (
        <Card style={{ flexDirection: 'row', gap: space.md }}>
          <Icon name="coffee" size={16} color={colors.muted} />
          <T variant="caption" style={{ flex: 1 }}>
            Henüz yok. Plan düzenleyicide bir tarifin yanındaki “uyarla” düğmesiyle ya da Tarifler sayfasında “Varyasyon oluştur” ile hazırlayabilirsiniz.
          </T>
        </Card>
      ) : (
        <Card padded={false}>
          {items.map((r, i) => (
            <ListItem key={r.id} icon="book-open" last={i === items.length - 1} title={r.title} subtitle={r.variantNote || RECIPE_CATEGORY_LABEL[r.category]} onPress={() => router.push(`/panel/tarifler/${r.id}`)} />
          ))}
        </Card>
      )}
    </Section>
  );
}

export function PlansTab({ clientId, clientName }: { clientId: string; clientName: string }) {
  const q = useApiQuery(clientKeys.plans(clientId), () => api.get<{ items: PlanListItem[] }>('/plans', { clientId }));
  const [printing, setPrinting] = useState<string | null>(null);
  const toast = useToast();
  const newPlan = () => router.push(`/panel/planlar/yeni?clientId=${clientId}`);

  async function pdf(p: PlanListItem) {
    setPrinting(p.id);
    try {
      await api.printPdf(`/plans/${p.id}/print`, `${p.name} - ${clientName}`);
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setPrinting(null);
    }
  }

  return (
    <View>
      <Section title="Beslenme planları" action={<Button title="Yeni plan" icon="plus" size="sm" onPress={newPlan} />}>
        <T variant="caption" style={{ marginBottom: space.sm, paddingHorizontal: 2 }}>A4 yazdırma sayfası PDF olarak hazırlanır; paylaşabilir ya da yazdırabilirsiniz.</T>
        <QueryView query={q}>
          {(data) =>
            !data.items.length ? (
              <Card>
                <Empty icon="file-text" title="Henüz plan yok" text="Şablondan başlayıp danışana göre düzenleyebilirsiniz." action={<Button title="İlk planı oluştur" icon="plus" onPress={newPlan} />} />
              </Card>
            ) : (
              <Card padded={false}>
                {data.items.map((p, i) => (
                  <ListItem
                    key={p.id}
                    icon="file-text"
                    last={i === data.items.length - 1}
                    title={p.name}
                    subtitle={`Son düzenleme ${formatDateTime(p.updatedAt)}`}
                    onPress={() => router.push(`/panel/planlar/${p.id}`)}
                    right={
                      printing === p.id ? (
                        <T variant="caption">PDF…</T>
                      ) : (
                        <IconButton name="printer" label={`${p.name} yazdır / PDF`} onPress={() => void pdf(p)} color={colors.goldInk} />
                      )
                    }
                  />
                ))}
              </Card>
            )
          }
        </QueryView>
      </Section>
      <ClientRecipes clientId={clientId} />
    </View>
  );
}
