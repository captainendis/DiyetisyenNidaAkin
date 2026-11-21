// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Panel → Yeni danışan */
import { router, Stack } from 'expo-router';
import { Button, Empty, Screen } from '@/components/ui';
import { useStaff } from '@/lib/auth';
import { useClientForm } from '@/features/clients/ClientForm';

export default function NewClientScreen() {
  const { can } = useStaff();
  const form = useClientForm({ active: true, onSaved: (c) => router.replace(`/panel/danisanlar/${c.id}`) });
  if (!can('clients:write')) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Yeni danışan' }} />
        <Empty icon="lock" title="Danışan ekleme yetkiniz yok" />
      </Screen>
    );
  }
  return (
    <Screen footer={<Button title="Danışanı ekle" full loading={form.pending} onPress={() => void form.submit()} />}>
      <Stack.Screen options={{ title: 'Yeni danışan' }} />
      {form.fields}
    </Screen>
  );
}
