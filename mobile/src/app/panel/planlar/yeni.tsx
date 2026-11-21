// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Yeni beslenme planı: danışan (isteğe bağlı) + kaynak (boş / şablon) — web: NewPlanModal.
 * ?clientId=<id> danışan sabit gelir; ?sablon=1 şablon olarak başlar.
 */
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Empty, Form, Loading, Notice, Screen, SelectField, SwitchField, T, TextField, useToast } from '@/components/ui';
import { api, ApiError, errorMessage } from '@/lib/api';
import { useStaff } from '@/lib/auth';
import { queryClient, useApiQuery } from '@/lib/query';
import { space } from '@/theme';
import type { PlanListItem } from '@/features/plans/api';
import type { ClientRef } from '@/features/recipes/api';
import { ClientPicker } from '@/features/recipes/ClientPicker';

export default function NewPlanScreen() {
  const params = useLocalSearchParams<{ clientId?: string; sablon?: string }>();
  const fixedClientId = params.clientId || null;
  const { can } = useStaff();
  const editable = can('clinical:write');
  const toast = useToast();
  const [asTemplate, setAsTemplate] = useState(!fixedClientId && params.sablon === '1');
  const [client, setClient] = useState<ClientRef | null>(null);
  const [name, setName] = useState('');
  const [fromId, setFromId] = useState('');
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<Record<string, string>>({});

  const templates = useApiQuery(['plans', 'list', 'sablonlar', ''], () => api.get<{ items: PlanListItem[] }>('/plans', { templates: '1' }), { enabled: editable });
  const fixedClient = useApiQuery(['clients', fixedClientId], () => api.get<{ client: ClientRef }>(`/clients/${fixedClientId}`), { enabled: editable && !!fixedClientId });

  const targetClientId = fixedClientId ?? client?.id ?? null;
  const fixedName = fixedClient.data ? `${fixedClient.data.client.firstName} ${fixedClient.data.client.lastName}` : null;

  const create = async () => {
    setErr({});
    if (!name.trim()) return setErr({ name: 'Plan adı gerekli' });
    if (!asTemplate && !targetClientId) return setErr({ client: 'Bir danışan seçin ya da şablon olarak kaydedin' });
    setPending(true);
    try {
      const res = await api.post<{ plan: PlanListItem }>('/plans', {
        clientId: asTemplate ? null : targetClientId,
        isTemplate: asTemplate,
        name: name.trim(),
        fromId: fromId || null,
      });
      await queryClient.invalidateQueries({ queryKey: ['plans'] });
      router.replace(`/panel/planlar/${res.plan.id}`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) setErr(e.fields);
      else toast(`Plan oluşturulamadı: ${errorMessage(e)}`, 'error');
    } finally {
      setPending(false);
    }
  };

  const title = fixedClientId ? `${fixedName ?? 'Danışan'} için yeni plan` : 'Yeni beslenme planı';

  if (!editable) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Yeni plan' }} />
        <Empty icon="lock" title="Yetki yok" text="Plan oluşturmak için klinik kayıt yazma yetkisi gerekir." />
      </Screen>
    );
  }
  if (fixedClientId && fixedClient.isPending) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Yeni plan' }} />
        <Loading />
      </Screen>
    );
  }

  return (
    <Screen footer={<Button title="Oluştur ve düzenle" icon="arrow-right" full loading={pending} onPress={() => void create()} />}>
      <Stack.Screen options={{ title: 'Yeni plan' }} />
      <T variant="title" style={{ marginBottom: space.lg }}>{title}</T>
      <Form>
        {fixedClientId && fixedClient.error ? <Notice tone="danger" text={`Danışan bilgisi alınamadı: ${errorMessage(fixedClient.error)}`} /> : null}
        {!fixedClientId ? (
          <Card>
            <SwitchField
              label="Şablon olarak oluştur"
              help="Danışana bağlı olmayan, yeni planlara temel olacak liste."
              value={asTemplate}
              onChange={setAsTemplate}
            />
          </Card>
        ) : null}
        {!fixedClientId && !asTemplate ? <ClientPicker label="Danışan" required value={client} onChange={setClient} error={err.client} /> : null}
        <TextField label="Plan adı" required placeholder="Ör. Kasım planı" value={name} maxLength={80} error={err.name} onChange={setName} help="Yalnızca panelde listeleme için kullanılır." />
        <View>
          <SelectField<string>
            label="Başlangıç"
            value={fromId}
            onChange={setFromId}
            searchable={(templates.data?.items.length ?? 0) > 8}
            options={[{ value: '', label: 'Boş plan' }, ...(templates.data?.items ?? []).map((t) => ({ value: t.id, label: `Şablon: ${t.name}` }))]}
            help={templates.isPending ? 'Şablonlar yükleniyor…' : 'Şablonun içeriği kopyalanır; şablonun kendisi değişmez.'}
            error={err.fromId}
          />
        </View>
      </Form>
    </Screen>
  );
}
