// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Raporlar (reports:read) */
import { Stack } from 'expo-router';
import { ReportsScreen } from '@/features/reports/ReportsScreen';
import { RequirePermission } from '@/features/settings/Gate';

export default function ReportsRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Raporlar' }} />
      <RequirePermission perm="reports:read">
        <ReportsScreen />
      </RequirePermission>
    </>
  );
}
