// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Hesabım (danışan). Sekmeler + üstüne açılan detay ekranları (liste, tarif …). */
import { Stack } from 'expo-router';
import { stackScreenOptions } from '@/components/nav';

export default function ClientLayout() {
  return (
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Hesabım' }} />
    </Stack>
  );
}
