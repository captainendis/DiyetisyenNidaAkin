// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Gezinme ortakları: Stack başlık stili, sekme stili, okunmamış bildirim sayısı */
import type { ComponentProps } from 'react';
import type { Stack } from 'expo-router';
import { api } from '@/lib/api';
import { useApiQuery } from '@/lib/query';
import { colors, fonts } from '@/theme';

export const stackScreenOptions: ComponentProps<typeof Stack>['screenOptions'] = {
  headerShadowVisible: false,
  headerStyle: { backgroundColor: colors.bg },
  headerTintColor: colors.text,
  headerTitleStyle: { fontFamily: fonts.semibold, fontSize: 16 },
  headerBackButtonDisplayMode: 'minimal',
  contentStyle: { backgroundColor: colors.bg },
};

export const tabScreenOptions = {
  headerShadowVisible: false,
  headerStyle: { backgroundColor: colors.bg },
  headerTitleStyle: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text },
  headerTintColor: colors.text,
  sceneStyle: { backgroundColor: colors.bg },
  tabBarActiveTintColor: colors.espresso,
  tabBarInactiveTintColor: colors.muted,
  tabBarStyle: { backgroundColor: colors.ivory, borderTopColor: colors.line },
  tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 11 },
} as const;

/** Personel: okunmamış bildirim sayısı (60 sn'de bir tazelenir) */
export function useUnreadCount() {
  const q = useApiQuery(['notifications', 'unread-count'], () => api.get<{ count: number }>('/notifications/unread-count'), { refetchInterval: 60_000 });
  return q.data?.count ?? 0;
}
