// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Ayarlar → WhatsApp Business */
import { Stack } from 'expo-router';
import { WhatsappCloudSection } from '@/features/settings/ChannelsSections';
import { RequirePermission } from '@/features/settings/Gate';

export default function Route() {
  return (
    <>
      <Stack.Screen options={{ title: 'WhatsApp Business' }} />
      <RequirePermission perm={['settings:write', 'content:write']}>
        <WhatsappCloudSection />
      </RequirePermission>
    </>
  );
}
