// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Denetim kayıtları (audit:read) */
import { Stack } from 'expo-router';
import { AuditLog } from '@/features/settings/AuditLog';
import { RequirePermission } from '@/features/settings/Gate';

export default function AuditRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Denetim kayıtları' }} />
      <RequirePermission perm="audit:read">
        <AuditLog />
      </RequirePermission>
    </>
  );
}
