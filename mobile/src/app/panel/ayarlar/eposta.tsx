// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Ayarlar → E-posta (SMTP) */
import { Stack } from 'expo-router';
import { SmtpSection } from '@/features/settings/ChannelsSections';
import { RequirePermission } from '@/features/settings/Gate';

export default function Route() {
  return (
    <>
      <Stack.Screen options={{ title: 'E-posta (SMTP)' }} />
      <RequirePermission perm={['settings:write', 'content:write']}>
        <SmtpSection />
      </RequirePermission>
    </>
  );
}
