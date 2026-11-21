// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Panel (Nida Akın ve ekibi). Sekmeler (tabs) + üstüne açılan detay/düzenleme ekranları.
 * Detay ekranları başlığını kendi dosyasında <Stack.Screen options={{ title }} /> ile verir.
 */
import { Stack } from 'expo-router';
import { View } from 'react-native';
import { stackScreenOptions } from '@/components/nav';
import { OfflineBanner } from '@/components/OfflineBanner';

export default function PanelLayout() {
  return (
    <View style={{ flex: 1 }}>
      <OfflineBanner />
      <Stack screenOptions={stackScreenOptions}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Panel' }} />
      </Stack>
    </View>
  );
}
