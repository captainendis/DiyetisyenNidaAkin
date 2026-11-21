// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Web sitesi içeriği → Sık sorulan sorular */
import { Stack } from 'expo-router';
import { FaqManager } from '@/features/content/FaqManager';
import { RequirePermission } from '@/features/settings/Gate';

export default function FaqScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Sık sorulan sorular' }} />
      <RequirePermission perm="content:write">
        <FaqManager />
      </RequirePermission>
    </>
  );
}
