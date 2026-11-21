// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Panel alt sekmeleri — role göre gizlenir (asistan klinik ekranları görmez) */
import type { ColorValue } from 'react-native';
import { router } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { IconButton, Icon, type IconName } from '@/components/ui';
import { tabScreenOptions, useUnreadCount } from '@/components/nav';
import { useStaff } from '@/lib/auth';

const icon = (name: IconName) => ({ color, size }: { color: ColorValue; size: number }) => <Icon name={name} color={String(color)} size={size - 2} />;

export default function PanelTabs() {
  const { can } = useStaff();
  const unread = useUnreadCount();
  const bell = () => <IconButton name="bell" label={`Bildirimler${unread ? ` (${unread} okunmamış)` : ''}`} badge={unread} onPress={() => router.push('/panel/bildirimler')} />;
  return (
    <Tabs screenOptions={{ ...tabScreenOptions, headerRight: () => <>{bell()}</>, headerRightContainerStyle: { paddingRight: 12 } }}>
      <Tabs.Screen name="index" options={{ title: 'Genel Bakış', tabBarLabel: 'Bugün', tabBarIcon: icon('sun'), href: can('dashboard:read') ? undefined : null }} />
      <Tabs.Screen name="randevular" options={{ title: 'Randevular', tabBarIcon: icon('calendar'), href: can('appointments:read') ? undefined : null }} />
      <Tabs.Screen name="danisanlar" options={{ title: 'Danışanlar', tabBarIcon: icon('users'), href: can('clients:read') ? undefined : null }} />
      <Tabs.Screen name="talepler" options={{ title: 'Talepler', tabBarIcon: icon('inbox'), href: can('appointments:read') ? undefined : null }} />
      <Tabs.Screen name="menu" options={{ title: 'Menü', tabBarIcon: icon('grid'), tabBarBadge: unread ? (unread > 99 ? '99+' : unread) : undefined }} />
    </Tabs>
  );
}
