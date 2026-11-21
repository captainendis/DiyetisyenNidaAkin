// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Ayarlar → Profil */
import { Stack } from 'expo-router';
import { ProfileSection } from '@/features/settings/ProfileSection';

export default function ProfileRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Profil' }} />
      <ProfileSection />
    </>
  );
}
