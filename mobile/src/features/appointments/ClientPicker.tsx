// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Yeni randevu: kayıtlı danışan arama ya da yeni kişi bilgileri */
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Button, Card, IconButton, ListItem, T, TextField } from '@/components/ui';
import { api } from '@/lib/api';
import { formatPhone } from '@/lib/format';
import { useApiQuery } from '@/lib/query';
import { colors, space } from '@/theme';

export interface ClientLite {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
}
export interface Contact {
  name: string;
  phone: string;
  email: string;
}

export function ClientPicker({
  client,
  setClient,
  mode,
  setMode,
  contact,
  setContact,
  errors,
}: {
  client: ClientLite | null;
  setClient: (c: ClientLite | null) => void;
  mode: 'search' | 'new';
  setMode: (m: 'search' | 'new') => void;
  contact: Contact;
  setContact: (c: Contact) => void;
  errors: Record<string, string>;
}) {
  const [q, setQ] = useState('');
  const [dq, setDq] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDq(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);
  const search = useApiQuery(['clients', 'search', dq], () => api.get<{ items: ClientLite[] }>('/clients', { q: dq, pageSize: 8 }), {
    enabled: !client && mode === 'search' && dq.length >= 2,
  });

  if (client) {
    return (
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <View style={{ flex: 1 }}>
          <T variant="subheading">{client.firstName} {client.lastName}</T>
          <T variant="caption">{formatPhone(client.phone)}{client.email ? ` · ${client.email}` : ''}</T>
        </View>
        <IconButton name="x" label="Danışan seçimini kaldır" onPress={() => setClient(null)} />
      </Card>
    );
  }

  const toggle = (
    <Button
      title={mode === 'search' ? 'Yeni kişi' : 'Kayıtlı danışan ara'}
      icon={mode === 'search' ? 'user-plus' : 'search'}
      variant="ghost"
      size="sm"
      style={{ alignSelf: 'flex-start' }}
      onPress={() => setMode(mode === 'search' ? 'new' : 'search')}
    />
  );

  if (mode === 'new') {
    return (
      <View style={{ gap: space.md }}>
        <TextField label="Ad soyad" required value={contact.name} onChange={(name) => setContact({ ...contact, name })} error={errors.contactName} placeholder="Ad Soyad" autoCapitalize="words" />
        <TextField label="Telefon" required value={contact.phone} onChange={(phone) => setContact({ ...contact, phone })} error={errors.contactPhone} placeholder="05xx xxx xx xx" keyboardType="phone-pad" />
        <TextField label="E-posta" value={contact.email} onChange={(email) => setContact({ ...contact, email })} error={errors.contactEmail} placeholder="ornek@eposta.com" keyboardType="email-address" autoCapitalize="none" />
        <T variant="caption">Bu telefonla kayıtlı danışan yoksa yeni danışan kaydı oluşturulur.</T>
        {toggle}
      </View>
    );
  }

  const results = search.data?.items ?? [];
  return (
    <View style={{ gap: space.sm }}>
      <TextField value={q} onChange={setQ} icon="search" placeholder="Ad, soyad veya telefon ile arayın" autoCorrect={false} error={errors.client} accessibilityLabel="Danışan ara" />
      {search.isFetching ? <ActivityIndicator color={colors.gold} style={{ alignSelf: 'flex-start' }} /> : null}
      {search.error ? <T variant="caption">Danışan araması şu anda kullanılamıyor — “Yeni kişi” ile devam edebilirsiniz.</T> : null}
      {results.length ? (
        <Card padded={false} style={{ overflow: 'hidden' }}>
          {results.map((c, i) => (
            <ListItem key={c.id} title={`${c.firstName} ${c.lastName}`} subtitle={formatPhone(c.phone)} last={i === results.length - 1} onPress={() => setClient(c)} />
          ))}
        </Card>
      ) : null}
      {search.data && !search.isFetching && dq.length >= 2 && !results.length ? (
        <View style={{ gap: 4 }}>
          <T variant="caption">Eşleşen danışan bulunamadı.</T>
          <Button
            title="Yeni kişi olarak ekle"
            size="sm"
            variant="secondary"
            style={{ alignSelf: 'flex-start' }}
            onPress={() => {
              setMode('new');
              setContact({ ...contact, name: q });
            }}
          />
        </View>
      ) : null}
      {toggle}
    </View>
  );
}
