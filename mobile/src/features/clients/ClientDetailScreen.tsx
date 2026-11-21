// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Danışan detayı: başlık, işlemler ve sekmeler (web: ClientDetailPage) */
import { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Avatar, Badge, Button, Card, Empty, ErrorView, Icon, IconButton, Loading, Screen, T, useToast } from '@/components/ui';
import { api, ApiError, errorMessage } from '@/lib/api';
import { useStaff } from '@/lib/auth';
import { formatPhone } from '@/lib/format';
import { queryClient, useApiQuery } from '@/lib/query';
import { CLIENT_STATUS_LABEL } from '@shared/constants';
import { colors, space } from '@/theme';
import { AppointmentsTab } from './AppointmentsTab';
import { ClassesTab } from './ClassesTab';
import { ClientFormSheet } from './ClientForm';
import { ClinicalLocked, TabBar, useClientChanged } from './common';
import { DeleteClientSheet } from './DeleteClientSheet';
import { FilesTab } from './FilesTab';
import { MeasurementsTab } from './MeasurementsTab';
import { MessagesTab } from './MessagesTab';
import { NotesTab } from './NotesTab';
import { OverviewTab } from './OverviewTab';
import { PlansTab } from './PlansTab';
import { CLIENT_STATUS_TONE, clientKeys, type ClientDetail } from './types';

type Tab = 'genel' | 'randevular' | 'pilates' | 'notlar' | 'mesajlar' | 'planlar' | 'takip' | 'dosyalar';
const TABS: Tab[] = ['genel', 'randevular', 'pilates', 'notlar', 'mesajlar', 'planlar', 'takip', 'dosyalar'];

function Contact({ icon, text, onPress }: { icon: 'phone' | 'mail'; text: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="link" style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32 }, pressed && { opacity: 0.6 }]}>
      <Icon name={icon} size={14} color={colors.muted} />
      <T numberOfLines={1} style={{ flexShrink: 1 }}>{text}</T>
    </Pressable>
  );
}

export function ClientDetailScreen() {
  const params = useLocalSearchParams<{ id: string; sekme?: string }>();
  const id = String(params.id ?? '');
  const { can } = useStaff();
  const [tab, setTab] = useState<Tab>(TABS.includes(params.sekme as Tab) ? (params.sekme as Tab) : 'genel');
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const toast = useToast();
  const q = useApiQuery(clientKeys.detail(id), () => api.get<ClientDetail>(`/clients/${id}`), { enabled: !!id && can('clients:read') });
  const onClientChanged = useClientChanged(id);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        queryClient.refetchQueries({ queryKey: clientKeys.detail(id), type: 'active' }),
        queryClient.refetchQueries({ queryKey: clientKeys.plans(id), type: 'active' }),
        queryClient.refetchQueries({ queryKey: ['recipes', 'client', id], type: 'active' }),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  if (!can('clients:read')) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Danışan' }} />
        <Empty icon="lock" title="Bu bölüme erişim yetkiniz yok" />
      </Screen>
    );
  }
  if (q.isPending) {
    return (
      <Screen scroll={false}>
        <Stack.Screen options={{ title: 'Danışan' }} />
        <Loading />
      </Screen>
    );
  }
  if (q.error || !q.data) {
    const notFound = q.error instanceof ApiError && q.error.status === 404;
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Danışan' }} />
        {notFound ? (
          <Empty
            icon="user-x"
            title="Danışan bulunamadı"
            text="Kayıt silinmiş veya bağlantı hatalı olabilir."
            action={<Button title="Danışan listesine dön" variant="secondary" onPress={() => router.back()} />}
          />
        ) : (
          <ErrorView error={q.error} onRetry={() => void q.refetch()} />
        )}
      </Screen>
    );
  }

  const { client, stats } = q.data;
  const name = `${client.firstName} ${client.lastName}`;
  const clinical = can('clinical:read');

  async function exportData() {
    setExporting(true);
    try {
      await api.download(`/clients/${client.id}/export`, `danisan-verileri-${client.id}.json`);
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setExporting(false);
    }
  }

  const tabs = [
    { value: 'genel' as const, label: 'Genel Bakış' },
    { value: 'randevular' as const, label: 'Randevu Geçmişi' },
    ...(can('appointments:read') ? [{ value: 'pilates' as const, label: 'Pilates' }] : []),
    { value: 'notlar' as const, label: 'Görüşme Notları', locked: !clinical },
    { value: 'mesajlar' as const, label: 'Danışana Mesajlar', locked: !clinical },
    { value: 'planlar' as const, label: 'Beslenme Planları', locked: !clinical },
    { value: 'takip' as const, label: 'Beslenme Takibi', locked: !clinical },
    { value: 'dosyalar' as const, label: 'Dosyalar', locked: !clinical },
  ];

  return (
    <Screen refreshing={refreshing} onRefresh={() => void refresh()}>
      <Stack.Screen
        options={{
          title: name,
          headerRight: can('clients:write') ? () => <IconButton name="edit-2" label="Düzenle" onPress={() => setEditing(true)} /> : undefined,
        }}
      />
      <Card style={{ marginBottom: space.lg, gap: space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <Avatar name={name} size={56} />
          <View style={{ flex: 1, gap: 4 }}>
            <T variant="title" numberOfLines={2}>{name}</T>
            <Badge label={CLIENT_STATUS_LABEL[client.status]} tone={CLIENT_STATUS_TONE[client.status]} />
          </View>
        </View>
        <View>
          <Contact icon="phone" text={formatPhone(client.phone)} onPress={() => void Linking.openURL(`tel:${client.phone}`)} />
          {client.email ? <Contact icon="mail" text={client.email} onPress={() => void Linking.openURL(`mailto:${client.email}`)} /> : null}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {can('appointments:write') ? (
            <Button title="Yeni randevu" icon="calendar" size="sm" onPress={() => router.push(`/panel/randevular/yeni?clientId=${client.id}`)} />
          ) : null}
          {can('clients:write') ? <Button title="Düzenle" icon="edit-2" size="sm" variant="secondary" onPress={() => setEditing(true)} /> : null}
          <Button title="Veri dışa aktar" icon="download" size="sm" variant="secondary" loading={exporting} onPress={() => void exportData()} />
          {can('clients:delete') ? <Button title="Sil" icon="trash-2" size="sm" variant="danger" onPress={() => setDeleting(true)} /> : null}
        </View>
        <T variant="caption">“Veri dışa aktar”, KVKK md. 11 kapsamındaki bilgi talepleri için tüm kayıtları JSON olarak indirir.</T>
      </Card>

      <TabBar value={tab} tabs={tabs} onChange={setTab} />

      {tab === 'genel' ? <OverviewTab client={client} stats={stats} onClientChanged={onClientChanged} /> : null}
      {tab === 'randevular' ? <AppointmentsTab clientId={client.id} /> : null}
      {tab === 'pilates' && can('appointments:read') ? <ClassesTab clientId={client.id} /> : null}
      {tab === 'notlar' ? clinical ? <NotesTab clientId={client.id} /> : <ClinicalLocked /> : null}
      {tab === 'mesajlar' ? clinical ? <MessagesTab clientId={client.id} /> : <ClinicalLocked /> : null}
      {tab === 'planlar' ? clinical ? <PlansTab clientId={client.id} clientName={name} /> : <ClinicalLocked /> : null}
      {tab === 'takip' ? clinical ? <MeasurementsTab client={client} onClientChanged={onClientChanged} /> : <ClinicalLocked /> : null}
      {tab === 'dosyalar' ? clinical ? <FilesTab client={client} onClientChanged={onClientChanged} /> : <ClinicalLocked /> : null}

      <ClientFormSheet visible={editing} client={client} onClose={() => setEditing(false)} onSaved={() => setEditing(false)} />
      <DeleteClientSheet
        client={client}
        visible={deleting}
        onClose={() => setDeleting(false)}
        onDeleted={() => {
          setDeleting(false);
          router.back();
        }}
      />
    </Screen>
  );
}
