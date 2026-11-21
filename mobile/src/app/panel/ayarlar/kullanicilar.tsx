// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Ayarlar → Kullanıcılar */
import { Stack } from 'expo-router';
import { UsersSection } from '@/features/settings/UsersSection';
import { RequirePermission } from '@/features/settings/Gate';

export default function Route() {
  return (
    <>
      <Stack.Screen options={{ title: 'Kullanıcılar' }} />
      <RequirePermission perm={"users:manage"}>
        <UsersSection />
      </RequirePermission>
    </>
  );
}
