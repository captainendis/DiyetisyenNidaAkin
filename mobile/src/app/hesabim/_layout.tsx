// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Hesabım (danışan). Sekmeler + üstüne açılan detay ekranları (liste, tarif …). */
import { Stack } from 'expo-router';
import { View } from 'react-native';
import { stackScreenOptions } from '@/components/nav';
import { OfflineBanner } from '@/components/OfflineBanner';

export default function ClientLayout() {
  return (
    <View style={{ flex: 1 }}>
      <OfflineBanner />
      <Stack screenOptions={stackScreenOptions}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Hesabım' }} />
      </Stack>
    </View>
  );
}
