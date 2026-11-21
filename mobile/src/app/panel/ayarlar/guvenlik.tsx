// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Ayarlar → Hesap & Güvenlik */
import { Stack } from 'expo-router';
import { SecuritySection } from '@/features/settings/SecuritySection';

export default function SecurityRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Hesap & Güvenlik' }} />
      <SecuritySection />
    </>
  );
}
