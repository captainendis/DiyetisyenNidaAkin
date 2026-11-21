// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Hizmet yönetimi — sıralama (yukarı/aşağı), yayın durumu, düzenleme, silme. Web: ServicesAdminPage */
import { router, Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { Badge, Button, Card, confirm, Empty, Fab, Icon, IconButton, Notice, QueryView, Screen, T, useToast } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useStaff } from '@/lib/auth';
import { SITE_URL } from '@/lib/config';
import { formatMoney } from '@/lib/format';
import { queryClient, useApiQuery } from '@/lib/query';
import { colors, fonts, radius, space } from '@/theme';
import { ServiceIcon } from '@/features/services/ServiceIcon';
import { serviceKeys, type Service } from '@/features/services/types';

type List = { items: Service[] };

export default function ServicesScreen() {
  const { can } = useStaff();
  const toast = useToast();
  const allowed = can('services:write');
  const q = useApiQuery(serviceKeys.list, () => api.get<List>('/services'), { enabled: allowed });

  if (!allowed) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Hizmetler' }} />
        <Empty icon="lock" title="Erişim yok" text="Hizmetleri yönetme yetkiniz bulunmuyor." />
      </Screen>
    );
  }

  const setItems = (items: Service[]) => queryClient.setQueryData<List>(serviceKeys.list, { items });

  const persistOrder = async (next: Service[]) => {
    setItems(next);
    try {
      await api.post('/services/reorder', { ids: next.map((s) => s.id) });
    } catch {
      toast('Sıralama kaydedilemedi', 'error');
      void q.refetch();
    }
  };
  const move = (items: Service[], i: number, d: -1 | 1) => {
    const next = [...items];
    const [x] = next.splice(i, 1);
    next.splice(i + d, 0, x!);
    void persistOrder(next);
  };
  const toggle = async (items: Service[], s: Service) => {
    setItems(items.map((x) => (x.id === s.id ? { ...x, isPublished: !s.isPublished } : x)));
    try {
      await api.patch(`/services/${s.id}/visibility`, { isPublished: !s.isPublished });
      toast(s.isPublished ? 'Hizmet yayından kaldırıldı' : 'Hizmet yayınlandı');
    } catch {
      toast('Güncellenemedi', 'error');
      void q.refetch();
    }
  };
  const remove = async (s: Service) => {
    const ok = await confirm({
      title: 'Hizmeti sil',
      message: `“${s.title}” kalıcı olarak silinecek. Bu hizmetle oluşturulmuş randevular silinmez; yalnızca hizmet bağlantısı kaldırılır. Geçici olarak gizlemek için yayından kaldırmayı tercih edebilirsiniz.`,
      confirmText: 'Sil',
      destructive: true,
    });
    if (!ok) return;
    try {
      await api.del(`/services/${s.id}`);
      toast('Hizmet silindi');
      void q.refetch();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: 'Hizmetler',
          headerRight: () => <IconButton name="external-link" label="Sitede görüntüle" onPress={() => void WebBrowser.openBrowserAsync(`${SITE_URL}/hizmetler`)} />,
        }}
      />
      <Screen refreshing={q.refreshing} onRefresh={q.refresh} contentStyle={{ paddingBottom: 110 }}>
        <T variant="caption" style={{ marginBottom: space.lg }}>
          Ana sayfada ve Hizmetler sayfasında görünen hizmetler. Sıralamayı oklarla değiştirebilirsiniz.
        </T>
        <QueryView query={q}>
          {({ items }) => {
            if (!items.length) {
              return (
                <Empty
                  icon="feather"
                  title="Henüz hizmet yok"
                  text="Sunduğunuz danışmanlık hizmetlerini ekleyin; yayındaki hizmetler web sitesinde kart olarak listelenir."
                  action={<Button title="Hizmet ekle" icon="plus" onPress={() => router.push('/panel/hizmetler/duzenle')} />}
                />
              );
            }
            const untouched = items.some((s) => s.createdAt === s.updatedAt);
            return (
              <View style={{ gap: space.md }}>
                {untouched ? (
                  <Notice tone="warning" text="Hizmet metinleri taslaktır; sunulan hizmetleri doğrulayıp düzenleyin. Sunmadığınız hizmetleri yayından kaldırın veya silin." />
                ) : null}
                {items.map((s, i) => (
                  <Card key={s.id} padded={false} style={!s.isPublished && { backgroundColor: '#FBF8F3' }}>
                    <Pressable
                      onPress={() => router.push(`/panel/hizmetler/duzenle?id=${s.id}`)}
                      accessibilityRole="button"
                      accessibilityLabel={`${s.title} düzenle`}
                      style={({ pressed }) => [styles.main, pressed && { opacity: 0.8 }]}
                    >
                      <T style={styles.num}>{String(i + 1).padStart(2, '0')}</T>
                      <View style={[styles.iconTile, { backgroundColor: s.isPublished ? colors.espresso : '#EDE6DB' }]}>
                        <ServiceIcon name={s.icon} size={22} color={s.isPublished ? colors.rose : colors.taupe} />
                      </View>
                      <View style={{ flex: 1, gap: 3 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
                          <T variant="subheading" color={s.isPublished ? undefined : colors.muted}>{s.title}</T>
                          {!s.isPublished ? <Badge label="Yayında değil" /> : null}
                        </View>
                        <T variant="caption" numberOfLines={2}>{s.summary}</T>
                        {s.durationMinutes || s.priceCents != null ? (
                          <T variant="caption">
                            {[s.durationMinutes ? `${s.durationMinutes} dk` : null, s.priceCents != null ? `${formatMoney(s.priceCents)}${s.showPrice ? '' : ' (gizli)'}` : null]
                              .filter(Boolean)
                              .join(' · ')}
                          </T>
                        ) : null}
                      </View>
                      <Icon name="chevron-right" size={18} color={colors.mist} />
                    </Pressable>
                    <View style={styles.bar}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flex: 1 }}>
                        <Switch
                          value={s.isPublished}
                          onValueChange={() => void toggle(items, s)}
                          accessibilityLabel={`${s.title} yayında`}
                          trackColor={{ true: colors.gold, false: colors.line }}
                        />
                        <T variant="caption">{s.isPublished ? 'Yayında' : 'Gizli'}</T>
                      </View>
                      <ActionIcon name="arrow-up" label="Yukarı taşı" disabled={i === 0} onPress={() => move(items, i, -1)} />
                      <ActionIcon name="arrow-down" label="Aşağı taşı" disabled={i === items.length - 1} onPress={() => move(items, i, 1)} />
                      <ActionIcon name="edit-2" label="Düzenle" onPress={() => router.push(`/panel/hizmetler/duzenle?id=${s.id}`)} />
                      <ActionIcon name="trash-2" label="Sil" danger onPress={() => void remove(s)} />
                    </View>
                  </Card>
                ))}
              </View>
            );
          }}
        </QueryView>
      </Screen>
      <Fab label="Yeni hizmet" onPress={() => router.push('/panel/hizmetler/duzenle')} />
    </View>
  );
}

function ActionIcon({ name, label, onPress, disabled, danger }: { name: 'arrow-up' | 'arrow-down' | 'edit-2' | 'trash-2'; label: string; onPress: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [styles.action, disabled && { opacity: 0.3 }, pressed && { backgroundColor: '#F4EEE5' }]}
    >
      <Icon name={name} size={18} color={danger ? colors.dangerInk : colors.cocoa} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  main: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  num: { fontFamily: fonts.display, fontSize: 17, color: colors.goldInk, width: 22 },
  iconTile: { width: 44, height: 44, borderRadius: radius.sm + 2, alignItems: 'center', justifyContent: 'center' },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: space.md, paddingVertical: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  action: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
