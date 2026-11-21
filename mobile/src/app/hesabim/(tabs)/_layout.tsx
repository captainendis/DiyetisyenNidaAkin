// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Hesabım alt sekmeleri. Danışanın aldığı hizmete göre (programs) gösterilir — web'deki PortalShell ile aynı kural:
 * beslenme danışanı Listelerim'i, pilates danışanı Pilates'i görür; ikisini de alan ikisini de.
 */
import type { ColorValue } from 'react-native';
import { Tabs } from 'expo-router/js-tabs';
import { Icon, type IconName } from '@/components/ui';
import { tabScreenOptions } from '@/components/nav';
import { useClient } from '@/lib/auth';

const icon = (name: IconName) => ({ color, size }: { color: ColorValue; size: number }) => <Icon name={name} color={String(color)} size={size - 2} />;

export default function ClientTabs() {
  const { programs } = useClient();
  return (
    <Tabs screenOptions={tabScreenOptions}>
      <Tabs.Screen name="index" options={{ title: 'Özet', tabBarIcon: icon('home') }} />
      <Tabs.Screen name="listeler" options={{ title: 'Listelerim', tabBarIcon: icon('clipboard'), href: programs.nutrition ? undefined : null }} />
      <Tabs.Screen name="pilates" options={{ title: 'Pilates', tabBarIcon: icon('activity'), href: programs.pilates ? undefined : null }} />
      <Tabs.Screen name="randevular" options={{ title: 'Randevular', tabBarIcon: icon('calendar') }} />
      <Tabs.Screen name="menu" options={{ title: 'Daha fazla', tabBarIcon: icon('menu') }} />
    </Tabs>
  );
}
