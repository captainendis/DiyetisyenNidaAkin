// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Danışan listesi: arama, durum filtresi, sıralama, sonsuz kaydırma (web: ClientsPage) */
import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Avatar, Badge, Button, Chips, Empty, ErrorView, Fab, Loading, SelectField, T, TextField } from '@/components/ui';
import { api, type ApiError } from '@/lib/api';
import { useStaff } from '@/lib/auth';
import { formatDate, formatPhone } from '@/lib/format';
import { CLIENT_STATUS_LABEL, CLIENT_STATUSES, type ClientStatus } from '@shared/constants';
import { colors, radius, space } from '@/theme';
import { CLIENT_STATUS_TONE, type ClientListItem, type ClientListResponse } from './types';

type Sort = '-createdAt' | 'createdAt' | 'name' | '-lastVisit';
const SORTS: { value: Sort; label: string }[] = [
  { value: '-createdAt', label: 'En yeni kayıt' },
  { value: 'createdAt', label: 'En eski kayıt' },
  { value: 'name', label: 'Ada göre (A–Z)' },
  { value: '-lastVisit', label: 'Son görüşme' },
];
const PAGE_SIZE = 25;

function useDebounced<V>(value: V, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function Row({ c }: { c: ClientListItem }) {
  const name = `${c.firstName} ${c.lastName}`;
  return (
    <Pressable
      onPress={() => router.push(`/panel/danisanlar/${c.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${CLIENT_STATUS_LABEL[c.status]}`}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
    >
      <Avatar name={name} />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <T variant="subheading" numberOfLines={1} style={{ flex: 1 }}>{name}</T>
          <Badge label={CLIENT_STATUS_LABEL[c.status]} tone={CLIENT_STATUS_TONE[c.status]} />
        </View>
        <T variant="caption" color={colors.text}>
          {formatPhone(c.phone)}
          {c.source === 'WEBSITE' ? ' · Web sitesinden' : ''}
        </T>
        <T variant="caption">
          {c.totalVisits} görüşme · Son: {c.lastVisitAt ? formatDate(c.lastVisitAt) : 'henüz yok'} · Kayıt {formatDate(c.createdAt)}
        </T>
      </View>
    </Pressable>
  );
}

export function ClientListScreen() {
  const { can } = useStaff();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'' | ClientStatus>('');
  const [sort, setSort] = useState<Sort>('-createdAt');
  const [refreshing, setRefreshing] = useState(false);
  const dq = useDebounced(q.trim(), 300);

  const query = useInfiniteQuery<ClientListResponse, ApiError>({
    queryKey: ['clients', 'list', { q: dq, status, sort }],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => api.get<ClientListResponse>('/clients', { q: dq, status, sort, page: pageParam as number, pageSize: PAGE_SIZE }),
    getNextPageParam: (last) => (last.page * last.pageSize < last.total ? last.page + 1 : undefined),
    enabled: can('clients:read'),
  });

  const items = query.data?.pages.flatMap((p) => p.items) ?? [];
  const total = query.data?.pages[0]?.total;
  const filtered = !!dq || !!status;
  const create = () => router.push('/panel/danisanlar/yeni');

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await query.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  if (!can('clients:read')) return <Empty icon="lock" title="Bu bölüme erişim yetkiniz yok" />;

  const header = (
    <View style={{ gap: space.md, marginBottom: space.md }}>
      <TextField value={q} onChange={setQ} placeholder="Ad, soyad, telefon veya e-posta ile ara" icon="search" autoCorrect={false} returnKeyType="search" clearButtonMode="while-editing" accessibilityLabel="Danışan ara" />
      <Chips<'' | ClientStatus>
        value={status}
        onChange={(v) => setStatus(v as '' | ClientStatus)}
        options={[{ value: '', label: 'Aktif ve pasif' }, ...CLIENT_STATUSES.map((s) => ({ value: s, label: CLIENT_STATUS_LABEL[s] }))]}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <T variant="caption" style={{ flex: 1 }}>
          {total != null ? `${total} kayıt${status ? ` · ${CLIENT_STATUS_LABEL[status]}` : ''}` : 'Danışan kayıtları ve görüşme geçmişi'}
        </T>
        <View style={{ width: 180 }}>
          <SelectField<Sort> value={sort} options={SORTS} onChange={setSort} label={undefined} placeholder="Sıralama" />
        </View>
      </View>
    </View>
  );

  let empty = null;
  if (query.isPending) empty = <Loading />;
  else if (query.error) empty = <ErrorView error={query.error} onRetry={() => void query.refetch()} />;
  else if (!items.length) {
    empty = filtered ? (
      <Empty
        icon="search"
        title="Eşleşen danışan bulunamadı"
        text="Arama terimini veya durum filtresini değiştirmeyi deneyin."
        action={<Button title="Filtreleri temizle" variant="secondary" size="sm" onPress={() => { setQ(''); setStatus(''); }} />}
      />
    ) : (
      <Empty
        icon="users"
        title="Henüz danışan kaydı bulunmuyor."
        text="Web sitesinden gelen randevu talepleri onaylandığında danışanlar burada listelenir. Dilerseniz şimdi elle de ekleyebilirsiniz."
        action={can('clients:write') ? <Button title="İlk danışanı ekle" icon="user-plus" onPress={create} /> : undefined}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={items}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => <Row c={item} />}
        ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
        ListHeaderComponent={header}
        ListEmptyComponent={empty ?? undefined}
        ListFooterComponent={query.isFetchingNextPage ? <ActivityIndicator color={colors.gold} style={{ marginVertical: space.lg }} /> : undefined}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
        }}
        onEndReachedThreshold={0.4}
        contentContainerStyle={{ padding: space.lg, paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.gold} colors={[colors.gold]} />}
      />
      {can('clients:write') ? <Fab icon="user-plus" label="Yeni danışan" onPress={create} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
});
