// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import { Stack } from 'expo-router';
import { colors, fonts } from '@/theme';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerTitleStyle: { fontFamily: fonts.semibold },
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="giris" options={{ title: '' }} />
      <Stack.Screen name="sifremi-unuttum" options={{ title: 'Şifremi unuttum' }} />
      <Stack.Screen name="baglanti" options={{ title: 'Hesap bağlantısı' }} />
      <Stack.Screen name="sifre-yenile" options={{ title: 'Şifre yenileme' }} />
    </Stack>
  );
}
