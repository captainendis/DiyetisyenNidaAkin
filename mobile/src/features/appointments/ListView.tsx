// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Liste görünümü: arama + filtreler (alttan açılan sayfa) + sayfalama + hızlı onay */
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import {
  APPOINTMENT_KIND_LABEL,
  APPOINTMENT_STATUSES,
  APPOINTMENT_STATUS_LABEL,
  MEETING_TYPE_LABEL,
  type AppointmentKind,
  type AppointmentStatus,
  type MeetingType,
} from '@shared/constants';
import { Button, Card, Chips, DateField, Empty, ErrorView, Loading, SelectField, Sheet, T, TextField, useToast } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useApiMutation, useApiQuery } from '@/lib/query';
import { relativeTime } from '@/lib/format';
import { space } from '@/theme';
import { AppointmentRow } from './AppointmentRow';
import { APPOINTMENT_INVALIDATE, appointmentTypeLabel, displayName, type AppointmentDTO, type AppointmentPage } from './types';

export interface ListFilters {
  from: string;
  to: string;
  statuses: AppointmentStatus[];
  meetingType: '' | MeetingType;
  kind: '' | AppointmentKind;
  q: string;
}
export const emptyFilters = (): ListFilters => ({ from: '', to: '', statuses: [], meetingType: '', kind: '', q: '' });

const PAGE_SIZE = 25;

export function useAppointmentList(filters: ListFilters, page: number) {
  return useApiQuery(['appointments', 'list', filters, page], () =>
    api.get<AppointmentPage>('/appointments', {
      from: filters.from || undefined,
      to: filters.to || undefined,
      status: filters.statuses.length ? filters.statuses : undefined,
      meetingType: filters.meetingType || undefined,
      kind: filters.kind || undefined,
      q: filters.q || undefined,
      page,
      pageSize: PAGE_SIZE,
      sort: '-startsAt',
    }),
  );
}

export function ListView({
  filters,
  setFilters,
  page,
  setPage,
  query,
  onOpen,
  canWrite,
}: {
  filters: ListFilters;
  setFilters: (f: ListFilters) => void;
  page: number;
  setPage: (p: number) => void;
  query: ReturnType<typeof useAppointmentList>;
  onOpen: (id: string) => void;
  canWrite: boolean;
}) {
  const toast = useToast();
  const [q, setQ] = useState(filters.q);
  const [sheet, setSheet] = useState(false);

  // Arama: 300 ms gecikmeli
  useEffect(() => {
    const t = setTimeout(() => {
      if (q !== filters.q) {
        setFilters({ ...filters, q });
        setPage(1);
      }
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const confirmM = useApiMutation((a: AppointmentDTO) => api.post(`/appointments/${a.id}/status`, { status: 'CONFIRMED' }), {
    invalidate: APPOINTMENT_INVALIDATE,
    onSuccess: (_, a) => toast(`Randevu onaylandı · ${displayName(a)}`),
  });

  const filterCount = (filters.from ? 1 : 0) + (filters.to ? 1 : 0) + filters.statuses.length + (filters.meetingType ? 1 : 0) + (filters.kind ? 1 : 0);
  const active = filterCount > 0 || !!filters.q;
  const apply = (f: ListFilters) => {
    setFilters(f);
    setPage(1);
  };
  const data = query.data;

  return (
    <View style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <TextField value={q} onChange={setQ} placeholder="Danışan adı, telefon, e-posta" icon="search" autoCorrect={false} accessibilityLabel="Randevularda ara" returnKeyType="search" />
        </View>
        <Button title={filterCount ? `Filtreler (${filterCount})` : 'Filtreler'} icon="sliders" variant="secondary" onPress={() => setSheet(true)} />
      </View>
      {active ? (
        <Button
          title="Filtreleri temizle"
          icon="x"
          variant="ghost"
          size="sm"
          style={{ alignSelf: 'flex-start' }}
          onPress={() => {
            setQ('');
            apply(emptyFilters());
          }}
        />
      ) : null}

      {query.error ? (
        <ErrorView error={query.error} onRetry={() => void query.refetch()} />
      ) : !data ? (
        <Loading />
      ) : !data.items.length ? (
        <Empty
          icon="calendar"
          title={active ? 'Bu filtrelerle eşleşen randevu yok' : 'Henüz randevunuz bulunmuyor.'}
          text={active ? 'Filtreleri genişletmeyi veya temizlemeyi deneyin.' : 'Web sitesinden gelen talepler ve panelden oluşturduğunuz randevular burada listelenir.'}
        />
      ) : (
        <>
          <Card padded={false} style={{ overflow: 'hidden', opacity: query.isFetching && !query.refreshing ? 0.7 : 1 }}>
            {data.items.map((a, i) => (
              <AppointmentRow
                key={a.id}
                appointment={a}
                showDate
                last={i === data.items.length - 1}
                subtitle={`${appointmentTypeLabel(a)} · ${relativeTime(a.createdAt)} oluşturuldu`}
                onPress={() => onOpen(a.id)}
                action={
                  canWrite && (a.status === 'PENDING' || (a.status === 'NEW_REQUEST' && a.date)) ? (
                    <Button
                      title="Onayla"
                      icon="check"
                      size="sm"
                      variant="secondary"
                      loading={confirmM.isPending && confirmM.variables?.id === a.id}
                      onPress={() => confirmM.mutate(a, { onError: (e) => toast(errorMessage(e), 'error') })}
                    />
                  ) : undefined
                }
              />
            ))}
          </Card>
          <Pager page={data.page} pageSize={data.pageSize} total={data.total} onChange={setPage} />
        </>
      )}

      <FilterSheet visible={sheet} onClose={() => setSheet(false)} value={filters} onApply={(f) => apply({ ...f, q: filters.q })} />
    </View>
  );
}

export function Pager({ page, pageSize, total, onChange }: { page: number; pageSize: number; total: number; onChange: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return <T variant="caption" center>{total} kayıt</T>;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md }}>
      <Button title="Önceki" icon="chevron-left" size="sm" variant="secondary" disabled={page <= 1} onPress={() => onChange(page - 1)} />
      <T variant="caption">{start}–{end} / {total}</T>
      <Button title="Sonraki" size="sm" variant="secondary" disabled={page >= pages} onPress={() => onChange(page + 1)} />
    </View>
  );
}

function FilterSheet({ visible, onClose, value, onApply }: { visible: boolean; onClose: () => void; value: ListFilters; onApply: (f: ListFilters) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    if (visible) setDraft(value);
  }, [visible, value]);
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Filtreler"
      full
      footer={
        <>
          <Button title="Temizle" variant="secondary" style={{ flex: 1 }} onPress={() => setDraft({ ...emptyFilters(), q: draft.q })} />
          <Button
            title="Uygula"
            style={{ flex: 1 }}
            onPress={() => {
              onApply(draft);
              onClose();
            }}
          />
        </>
      }
    >
      <DateField label="Başlangıç" value={draft.from} onChange={(from) => setDraft({ ...draft, from })} clearable placeholder="Tüm tarihler" />
      <DateField label="Bitiş" value={draft.to} minimumDate={draft.from || undefined} onChange={(to) => setDraft({ ...draft, to })} clearable placeholder="Tüm tarihler" />
      <Chips
        label="Durum"
        multiple
        value={draft.statuses}
        options={APPOINTMENT_STATUSES.map((s) => ({ value: s, label: APPOINTMENT_STATUS_LABEL[s] }))}
        onChange={(v) => setDraft({ ...draft, statuses: v as AppointmentStatus[] })}
      />
      <SelectField<'' | MeetingType>
        label="Görüşme türü"
        value={draft.meetingType}
        options={[{ value: '', label: 'Tüm görüşme türleri' }, { value: 'IN_PERSON', label: MEETING_TYPE_LABEL.IN_PERSON }, { value: 'ONLINE', label: MEETING_TYPE_LABEL.ONLINE }]}
        onChange={(meetingType) => setDraft({ ...draft, meetingType })}
      />
      <SelectField<'' | AppointmentKind>
        label="Talep konusu"
        value={draft.kind}
        options={[{ value: '', label: 'Tüm talepler' }, { value: 'CONSULTATION', label: APPOINTMENT_KIND_LABEL.CONSULTATION }, { value: 'PILATES', label: APPOINTMENT_KIND_LABEL.PILATES }]}
        onChange={(kind) => setDraft({ ...draft, kind })}
      />
    </Sheet>
  );
}
