// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Ayarlar → Bildirim tercihleri */
import { Stack } from 'expo-router';
import { NotificationsSection } from '@/features/settings/NotificationsSection';

export default function NotificationPrefsRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Bildirim tercihleri' }} />
      <NotificationsSection />
    </>
  );
}
