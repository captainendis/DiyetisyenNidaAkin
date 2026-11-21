// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Denetim kayıtları — kim, ne zaman, hangi işlemi yaptı (web: AuditLogPage.tsx) */
import { Stack } from 'expo-router';
import { useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { Badge, Button, Card, DateField, Empty, ErrorView, IconButton, KeyValue, ListItem, Loading, Screen, SelectField, Sheet, T } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDayStr, formatDateTime } from '@/lib/format';
import { useApiQuery } from '@/lib/query';
import { colors, radius, space } from '@/theme';
import { Pager } from '../content/FormBits';
import { AUDIT_ENTITY_LABEL, auditLabel as label, auditTone } from './auditLabels';

interface Row {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  user: { firstName: string; lastName: string; email: string } | null;
}

const PAGE_SIZE = 30;
const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });

export function AuditLog() {
  const [filters, setFilters] = useState({ action: '', entityType: '', from: '', to: '' });
  const [draft, setDraft] = useState(filters);
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<Row | null>(null);
  const facets = useApiQuery(['audit-logs', 'facets'], () => api.get<{ actions: string[]; entityTypes: string[] }>('/audit-logs/facets'));
  const list = useApiQuery(['audit-logs', 'list', filters, page], () =>
    api.get<{ items: Row[]; total: number; pageSize: number }>('/audit-logs', { ...filters, page, pageSize: PAGE_SIZE }),
  );
  const activeCount = Object.values(filters).filter(Boolean).length;
  const filtered = activeCount > 0;
  const clear = () => {
    const empty = { action: '', entityType: '', from: '', to: '' };
    setFilters(empty);
    setDraft(empty);
    setPage(1);
  };
  const who = (r: Row) => (r.user ? `${r.user.firstName} ${r.user.lastName}` : 'Sistem / anonim');

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Denetim kayıtları',
          headerRight: () => (
            <IconButton
              name="filter"
              label={filtered ? `Filtrele (${activeCount} etkin)` : 'Filtrele'}
              badge={activeCount || undefined}
              onPress={() => {
                setDraft(filters);
                setFilterOpen(true);
              }}
            />
          ),
        }}
      />
      <Screen refreshing={list.refreshing} onRefresh={list.refresh}>
        <T muted style={{ marginBottom: space.lg }}>
          Paneldeki kritik işlemlerin kaydı: girişler, veri değişiklikleri, dışa aktarımlar. Not içerikleri ve ölçüm değerleri kayda yazılmaz.
        </T>
        {filtered ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm, marginBottom: space.lg }}>
            {filters.action ? <Badge label={label(filters.action)} tone="gold" /> : null}
            {filters.entityType ? <Badge label={AUDIT_ENTITY_LABEL[filters.entityType] ?? filters.entityType} tone="gold" /> : null}
            {filters.from || filters.to ? (
              <Badge label={`${filters.from ? formatDayStr(filters.from, 'd MMM yyyy') : '…'} – ${filters.to ? formatDayStr(filters.to, 'd MMM yyyy') : '…'}`} tone="gold" />
            ) : null}
            <Button title="Temizle" variant="ghost" size="sm" onPress={clear} />
          </View>
        ) : null}
        {list.isPending ? (
          <Loading />
        ) : list.error || !list.data ? (
          <ErrorView error={list.error} onRetry={() => void list.refetch()} />
        ) : !list.data.items.length ? (
          <Empty
            icon="file-text"
            title={filtered ? 'Eşleşen kayıt yok' : 'Henüz kayıt yok'}
            text={filtered ? 'Filtreleri değiştirerek tekrar deneyin.' : 'Panelde işlem yapıldıkça burada listelenir.'}
            action={filtered ? <Button title="Filtreleri temizle" variant="secondary" size="sm" onPress={clear} /> : undefined}
          />
        ) : (
          <>
            <Card padded={false}>
              {list.data.items.map((r, i) => (
                <ListItem
                  key={r.id}
                  title={<Badge label={label(r.action)} tone={auditTone(r.action)} />}
                  subtitle={`${AUDIT_ENTITY_LABEL[r.entityType] ?? r.entityType} · ${who(r)}`}
                  meta={formatDateTime(r.createdAt)}
                  onPress={() => setDetail(r)}
                  last={i === list.data.items.length - 1}
                />
              ))}
            </Card>
            <Pager page={page} pageSize={list.data.pageSize} total={list.data.total} onChange={setPage} />
          </>
        )}
      </Screen>

      <Sheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        title="Filtrele"
        footer={
          <>
            <Button title="Temizle" variant="secondary" style={{ flex: 1 }} onPress={() => setDraft({ action: '', entityType: '', from: '', to: '' })} />
            <Button
              title="Uygula"
              style={{ flex: 1 }}
              onPress={() => {
                setFilters(draft);
                setPage(1);
                setFilterOpen(false);
              }}
            />
          </>
        }
      >
        <SelectField<string>
          label="İşlem"
          searchable
          value={draft.action}
          onChange={(v) => setDraft({ ...draft, action: v })}
          placeholder="Tüm işlemler"
          options={[{ value: '', label: 'Tüm işlemler' }, ...(facets.data?.actions ?? []).map((a) => ({ value: a, label: label(a) }))]}
        />
        <SelectField<string>
          label="Kayıt türü"
          value={draft.entityType}
          onChange={(v) => setDraft({ ...draft, entityType: v })}
          placeholder="Tüm türler"
          options={[{ value: '', label: 'Tüm türler' }, ...(facets.data?.entityTypes ?? []).map((t) => ({ value: t, label: AUDIT_ENTITY_LABEL[t] ?? t }))]}
        />
        <DateField label="Başlangıç" value={draft.from} clearable maximumDate={draft.to || undefined} onChange={(v) => setDraft({ ...draft, from: v })} />
        <DateField label="Bitiş" value={draft.to} clearable minimumDate={draft.from || undefined} onChange={(v) => setDraft({ ...draft, to: v })} />
      </Sheet>

      <Sheet visible={!!detail} onClose={() => setDetail(null)} title={detail ? label(detail.action) : ''} subtitle={detail ? formatDateTime(detail.createdAt) : undefined}>
        {detail ? (
          <>
            <Card>
              <KeyValue label="İşlem kodu" value={<T selectable style={{ fontFamily: MONO, fontSize: 12, textAlign: 'right' }}>{detail.action}</T>} />
              <KeyValue
                label="Kayıt"
                value={
                  <T style={{ textAlign: 'right' }} selectable>
                    {AUDIT_ENTITY_LABEL[detail.entityType] ?? detail.entityType}
                    {detail.entityId ? <T variant="caption">{` (${detail.entityId})`}</T> : null}
                  </T>
                }
              />
              <KeyValue label="Kullanıcı" value={detail.user ? `${who(detail)} — ${detail.user.email}` : 'Sistem / anonim'} />
              <KeyValue label="IP adresi" value={detail.ip ?? '—'} />
              <KeyValue label="Tarayıcı" value={<T variant="caption" style={{ textAlign: 'right' }}>{detail.userAgent ?? '—'}</T>} last />
            </Card>
            <T variant="label">Ayrıntılar</T>
            {detail.metadata && Object.keys(detail.metadata).length ? (
              <View style={{ backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: space.md }}>
                <Text selectable style={{ fontFamily: MONO, fontSize: 12, lineHeight: 18, color: colors.text }}>
                  {JSON.stringify(detail.metadata, null, 2)}
                </Text>
              </View>
            ) : (
              <T variant="caption">—</T>
            )}
          </>
        ) : null}
      </Sheet>
    </>
  );
}
