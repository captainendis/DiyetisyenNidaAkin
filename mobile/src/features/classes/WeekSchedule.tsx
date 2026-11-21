// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Haftalık ders programı: hafta gezinme, gün gün ders listesi, iptal edilenleri gösterme */
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Card, Empty, IconButton, ListItem, QueryView, RowBetween, Screen, Section, SwitchField, T, Button } from '@/components/ui';
import { api } from '@/lib/api';
import { addDays, formatDayStr, isoWeekday, todayStr } from '@/lib/format';
import { useApiQuery } from '@/lib/query';
import { colors, fonts, space } from '@/theme';
import { classKeys, SeatDots, SessionStatusBadge, timeRange, type ClassSessionDTO } from './shared';

const weekStart = (d: string) => addDays(d, -(isoWeekday(d) - 1));

export function WeekSchedule({ canWrite }: { canWrite: boolean }) {
  const today = todayStr();
  const [from, setFrom] = useState(() => weekStart(today));
  const [showCancelled, setShowCancelled] = useState(false);
  const to = addDays(from, 6);
  const q = useApiQuery(classKeys.sessions(from, to, { includeCancelled: '1' }), () =>
    api.get<{ items: ClassSessionDTO[] }>('/classes/sessions', { from, to, includeCancelled: '1' }),
  );

  const sameMonth = from.slice(0, 7) === to.slice(0, 7);
  const title = `${formatDayStr(from, sameMonth ? 'd' : 'd MMM')} – ${formatDayStr(to, 'd MMMM yyyy')}`;
  const isThisWeek = from === weekStart(today);

  return (
    <Screen refreshing={q.refreshing} onRefresh={q.refresh} contentStyle={{ paddingBottom: 110 }}>
      <Card style={{ marginBottom: space.lg, gap: space.sm }}>
        <RowBetween>
          <IconButton name="chevron-left" label="Önceki hafta" onPress={() => setFrom(addDays(from, -7))} />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <T variant="subheading" center>{title}</T>
            {isThisWeek ? <T variant="caption">Bu hafta</T> : null}
          </View>
          <IconButton name="chevron-right" label="Sonraki hafta" onPress={() => setFrom(addDays(from, 7))} />
        </RowBetween>
        {!isThisWeek ? <Button title="Bu haftaya dön" size="sm" variant="ghost" icon="rotate-ccw" onPress={() => setFrom(weekStart(today))} /> : null}
        <SwitchField label="İptal edilen dersleri göster" value={showCancelled} onChange={setShowCancelled} />
      </Card>

      <QueryView query={q}>
        {(data) => {
          const items = data.items.filter((s) => showCancelled || s.status !== 'CANCELLED');
          if (!items.length) {
            return (
              <Empty
                icon="calendar"
                title="Bu hafta ders yok"
                text={canWrite ? 'Tek ders ya da bir grubun haftalık programını “Ekle” ile oluşturabilirsiniz.' : undefined}
              />
            );
          }
          const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
          return days.map((d) => {
            const list = items.filter((s) => s.date === d);
            if (!list.length) return null;
            return (
              <Section key={d} title={`${formatDayStr(d, 'cccc, d MMMM')}${d === today ? ' · Bugün' : ''}`}>
                <Card padded={false}>
                  {list.map((s, i) => (
                    <ListItem
                      key={s.id}
                      left={
                        <View style={{ width: 52 }}>
                          <T style={{ fontFamily: fonts.bold, fontSize: 15, color: s.status === 'CANCELLED' ? colors.muted : colors.text }}>{s.time}</T>
                          <T variant="caption">{s.durationMinutes} dk</T>
                        </View>
                      }
                      title={
                        <T variant="subheading" numberOfLines={1} color={s.status === 'CANCELLED' ? colors.muted : undefined} style={s.status === 'CANCELLED' ? { textDecorationLine: 'line-through' } : undefined}>
                          {s.title}
                        </T>
                      }
                      subtitle={
                        <View style={{ gap: 6, marginTop: 2 }}>
                          <T variant="caption" numberOfLines={1}>
                            {timeRange(s.time, s.durationMinutes)} · {s.groupName ? `Grup: ${s.groupName}` : 'Tek seferlik ders'}
                          </T>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
                            <SeatDots taken={s.seatsTaken} capacity={s.capacity} />
                            {s.status !== 'SCHEDULED' ? <SessionStatusBadge status={s.status} /> : null}
                          </View>
                        </View>
                      }
                      onPress={() => router.push(`/panel/pilates/ders/${s.id}`)}
                      last={i === list.length - 1}
                    />
                  ))}
                </Card>
              </Section>
            );
          });
        }}
      </QueryView>
    </Screen>
  );
}
