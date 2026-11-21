// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Panel (Nida Akın ve ekibi). Sekmeler (tabs) + üstüne açılan detay/düzenleme ekranları.
 * Detay ekranları başlığını kendi dosyasında <Stack.Screen options={{ title }} /> ile verir.
 */
import { Stack } from 'expo-router';
import { stackScreenOptions } from '@/components/nav';

export default function PanelLayout() {
  return (
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Panel' }} />
    </Stack>
  );
}
