// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Pilates — haftalık ders programı ve gruplar.
 *  - "Dersler": hafta hafta ders listesi (web'de Randevular takvimindeki pilates dersleri); derse dokununca yoklama ekranı
 *  - "Gruplar": aktif / pasif gruplar (web'deki /panel/pilates); gruba dokununca üyeler + not defteri
 * Yetki: appointments:read (görüntüleme), appointments:write (ekleme/düzenleme)
 */
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Empty, Fab, ListItem, Screen, Segmented, Sheet } from '@/components/ui';
import { useStaff } from '@/lib/auth';
import { space } from '@/theme';
import { GroupList } from '@/features/classes/GroupList';
import { WeekSchedule } from '@/features/classes/WeekSchedule';

type Tab = 'dersler' | 'gruplar';

export default function PilatesScreen() {
  const { can } = useStaff();
  const params = useLocalSearchParams<{ sekme?: string }>();
  const [tab, setTab] = useState<Tab>(params.sekme === 'gruplar' ? 'gruplar' : 'dersler');
  const [menu, setMenu] = useState(false);
  const canWrite = can('appointments:write');

  if (!can('appointments:read')) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Pilates' }} />
        <Empty icon="lock" title="Erişim yok" text="Bu bölümü görüntüleme yetkiniz bulunmuyor." />
      </Screen>
    );
  }

  const go = (href: string) => {
    setMenu(false);
    router.push(href);
  };

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: 'Pilates' }} />
      <View style={{ paddingHorizontal: space.lg, paddingTop: space.md }}>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'dersler', label: 'Ders programı' },
            { value: 'gruplar', label: 'Gruplar' },
          ]}
        />
      </View>
      {tab === 'dersler' ? <WeekSchedule canWrite={canWrite} /> : <GroupList canWrite={canWrite} onNewGroup={() => router.push('/panel/pilates/grup/duzenle')} />}
      {canWrite ? <Fab label="Ekle" onPress={() => setMenu(true)} /> : null}

      <Sheet visible={menu} onClose={() => setMenu(false)} title="Ekle">
        <Card padded={false}>
          <ListItem icon="calendar" title="Tek ders ekle" subtitle="Telafi, deneme veya özel ders" onPress={() => go('/panel/pilates/ders/yeni')} />
          <ListItem icon="repeat" title="Ders programı ekle" subtitle="Bir grubun haftalık derslerini toplu oluşturun" onPress={() => go('/panel/pilates/program')} />
          <ListItem icon="users" title="Yeni grup" subtitle="Sabit saatte birlikte ders alan danışanlar" onPress={() => go('/panel/pilates/grup/duzenle')} last />
        </Card>
        <Button title="Vazgeç" variant="secondary" onPress={() => setMenu(false)} />
      </Sheet>
    </View>
  );
}
