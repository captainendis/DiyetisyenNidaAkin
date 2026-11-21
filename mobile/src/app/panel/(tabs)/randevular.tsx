// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Randevular — Liste | Gün | Hafta | Ay. Web: /panel/randevular (AppointmentsPage).
 * Parametreler: view, d (görünüm tarihi), status (liste filtresi; bildirim/genel bakış bağlantıları için).
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { APPOINTMENT_STATUSES, type AppointmentStatus } from '@shared/constants';
import { todayStr } from '@shared/time';
import { Button, ErrorView, Fab, Icon, IconButton, Loading, Screen, Segmented, SwitchField, T } from '@/components/ui';
import { api } from '@/lib/api';
import { useStaff } from '@/lib/auth';
import { useApiQuery } from '@/lib/query';
import { colors, fonts, radius, space } from '@/theme';
import {
  AgendaView,
  eachDayOf,
  MonthView,
  rangeFor,
  rangeTitle,
  shiftAnchor,
  useCalendarRange,
  type CalView,
} from '@/features/appointments/CalendarViews';
import { emptyFilters, ListView, useAppointmentList, type ListFilters } from '@/features/appointments/ListView';

type View_ = 'list' | CalView;
const VIEWS: { value: View_; label: string }[] = [
  { value: 'list', label: 'Liste' },
  { value: 'day', label: 'Gün' },
  { value: 'week', label: 'Hafta' },
  { value: 'month', label: 'Ay' },
];

export default function AppointmentsScreen() {
  const { can } = useStaff();
  const canWrite = can('appointments:write');
  const params = useLocalSearchParams<{ view?: string; d?: string; status?: string | string[] }>();
  const initialStatuses = ([] as string[]).concat(params.status ?? []).filter((s): s is AppointmentStatus => (APPOINTMENT_STATUSES as readonly string[]).includes(s));

  const [view, setView] = useState<View_>(() => (VIEWS.some((v) => v.value === params.view) ? (params.view as View_) : initialStatuses.length ? 'list' : 'day'));
  const [anchor, setAnchor] = useState(params.d && /^\d{4}-\d{2}-\d{2}$/.test(params.d) ? params.d : todayStr());
  const [showCancelled, setShowCancelled] = useState(false);
  const [filters, setFilters] = useState<ListFilters>(() => ({ ...emptyFilters(), statuses: initialStatuses }));
  const [page, setPage] = useState(1);

  // Başka ekrandan parametreyle gelindiğinde (sekme zaten açıkken) görünümü güncelle
  const statusKey = initialStatuses.join(',');
  useEffect(() => {
    if (params.view && VIEWS.some((v) => v.value === params.view)) setView(params.view as View_);
    if (params.d && /^\d{4}-\d{2}-\d{2}$/.test(params.d)) setAnchor(params.d);
    if (statusKey) {
      setView('list');
      setFilters({ ...emptyFilters(), statuses: statusKey.split(',') as AppointmentStatus[] });
      setPage(1);
    }
  }, [params.view, params.d, statusKey]);

  const calView: CalView = view === 'list' ? 'week' : view;
  const [from, to] = rangeFor(calView, anchor);
  const days = useMemo(() => eachDayOf(from, to), [from, to]);
  const cal = useCalendarRange(from, to, view !== 'list');
  const list = useAppointmentList(filters, page);
  const unscheduled = useApiQuery(['appointments', 'unscheduled'], () => api.get<{ total: number }>('/appointments', { status: 'NEW_REQUEST', pageSize: 1 }));

  const open = (id: string) => router.push(`/panel/randevular/${id}`);
  const create = (date?: string, time?: string) => {
    const qs = [date && `date=${date}`, time && `time=${time}`].filter(Boolean).join('&');
    router.push(`/panel/randevular/yeni${qs ? `?${qs}` : ''}`);
  };

  const refreshing = view === 'list' ? list.refreshing : cal.refreshing;
  const onRefresh = () => {
    void unscheduled.refetch();
    void (view === 'list' ? list.refresh() : cal.refresh());
  };

  return (
    <View style={{ flex: 1 }}>
      <Screen refreshing={refreshing} onRefresh={onRefresh} contentStyle={{ paddingBottom: canWrite ? 110 : undefined }}>
        <View style={{ gap: space.md }}>
          {unscheduled.data?.total ? (
            <Pressable
              onPress={() => router.push('/panel/talepler')}
              accessibilityRole="link"
              style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md, backgroundColor: '#F5E3DD' }, pressed && { opacity: 0.8 }]}
            >
              <Icon name="inbox" size={18} color={colors.roseInk} />
              <T variant="caption" color={colors.roseInk} style={{ flex: 1 }}>
                <T variant="caption" color={colors.roseInk} weight="bold">{unscheduled.data.total}</T> geri arama talebi saat atanmayı bekliyor — takvimde görünmezler.
              </T>
              <T variant="label" color={colors.roseInk}>Taleplere git</T>
            </Pressable>
          ) : null}

          {canWrite ? (
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Button title="Pilates dersi" icon="activity" size="sm" variant="secondary" style={{ flex: 1 }} onPress={() => router.push(`/panel/pilates/ders/yeni${view !== 'list' && anchor >= todayStr() ? `?date=${anchor}` : ''}`)} />
              <Button title="Ders programı" icon="repeat" size="sm" variant="secondary" style={{ flex: 1 }} onPress={() => router.push('/panel/pilates/program')} />
            </View>
          ) : null}

          <Segmented value={view} options={VIEWS} onChange={setView} />

          {view !== 'list' ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
                <IconButton name="chevron-left" label="Önceki" onPress={() => setAnchor(shiftAnchor(calView, anchor, -1))} />
                <Pressable onPress={() => setAnchor(todayStr())} style={{ flex: 1, alignItems: 'center' }} accessibilityRole="button" accessibilityLabel="Bugüne dön">
                  <T style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.text, textTransform: 'capitalize' }} numberOfLines={1}>{rangeTitle(calView, anchor, from, to)}</T>
                </Pressable>
                <IconButton name="chevron-right" label="Sonraki" onPress={() => setAnchor(shiftAnchor(calView, anchor, 1))} />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                {anchor !== todayStr() ? <Button title="Bugün" size="sm" variant="secondary" onPress={() => setAnchor(todayStr())} /> : null}
                <View style={{ flex: 1 }}>
                  <SwitchField label="İptal / gelmeyenler" value={showCancelled} onChange={setShowCancelled} />
                </View>
              </View>
              {cal.error ? (
                <ErrorView error={cal.error} onRetry={() => void cal.refetch()} />
              ) : !cal.data ? (
                <Loading />
              ) : view === 'month' ? (
                <MonthView
                  anchor={anchor}
                  from={from}
                  to={to}
                  data={cal.data}
                  showCancelled={showCancelled}
                  onPickDay={(d) => {
                    setAnchor(d);
                    setView('day');
                  }}
                />
              ) : (
                <AgendaView
                  days={days}
                  data={cal.data}
                  showCancelled={showCancelled}
                  onOpen={open}
                  onOpenClass={(c) => router.push(`/panel/pilates/ders/${c.id}`)}
                  onCreate={canWrite ? create : undefined}
                />
              )}
            </>
          ) : (
            <ListView filters={filters} setFilters={setFilters} page={page} setPage={setPage} query={list} onOpen={open} canWrite={canWrite} />
          )}
        </View>
      </Screen>
      {canWrite ? <Fab label="Yeni randevu" onPress={() => create(view === 'day' && anchor >= todayStr() ? anchor : undefined)} /> : null}
    </View>
  );
}
