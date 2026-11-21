// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Çalışma takvimi: haftalık çalışma saatleri + tatil/izin/özel günler. Web: /panel/ayarlar/takvim */
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Empty, ErrorView, Loading, Screen, Section, T } from '@/components/ui';
import { useStaff } from '@/lib/auth';
import { queryClient } from '@/lib/query';
import { space } from '@/theme';
import { AffectedWarning } from '@/features/calendar/AffectedWarning';
import { BlockedDates } from '@/features/calendar/BlockedDates';
import { useWeeklyRules, WeeklySchedule } from '@/features/calendar/WeeklySchedule';
import type { AffectedAppointment } from '@/features/calendar/types';

export default function CalendarSettingsScreen() {
  const { can } = useStaff();
  if (!can('availability:write')) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Çalışma takvimi' }} />
        <Empty icon="lock" title="Bu ekrana erişim izniniz yok" text="Çalışma takvimini yalnızca yetkili kullanıcılar düzenleyebilir." />
      </Screen>
    );
  }
  return <Inner />;
}

function Inner() {
  const [warnings, setWarnings] = useState<AffectedAppointment[]>([]);
  const ctl = useWeeklyRules(setWarnings);
  return (
    <Screen
      refreshing={ctl.q.refreshing}
      onRefresh={() => {
        void ctl.q.refresh();
        void queryClient.invalidateQueries({ queryKey: ['availability', 'blocked-dates'] });
      }}
      footer={
        ctl.dirty ? (
          <View style={{ flexDirection: 'row', gap: space.md }}>
            <Button title="Geri al" variant="secondary" style={{ flex: 1 }} onPress={ctl.reset} disabled={ctl.saving} />
            <Button title="Kaydet" style={{ flex: 1 }} loading={ctl.saving} onPress={() => void ctl.save()} />
          </View>
        ) : undefined
      }
    >
      <Stack.Screen options={{ title: 'Çalışma takvimi' }} />
      <View style={{ gap: space.sm, marginBottom: space.xl }}>
        <T muted>Randevu alınabilecek gün ve saatleri belirleyin. Web sitesinden talep alma süresi gibi kurallar Randevu Ayarları’ndadır.</T>
        <Button title="Randevu Ayarları" variant="ghost" size="sm" icon="settings" style={{ alignSelf: 'flex-start' }} onPress={() => router.push('/panel/ayarlar')} />
      </View>
      <AffectedWarning items={warnings} onDismiss={() => setWarnings([])} />
      <Section title="Haftalık çalışma saatleri">
        {ctl.q.error ? <ErrorView error={ctl.q.error} onRetry={() => void ctl.q.refetch()} /> : !ctl.rules ? <Loading /> : <WeeklySchedule ctl={ctl} />}
      </Section>
      <Section title="Tatil, izin ve özel günler">
        <BlockedDates onWarnings={setWarnings} />
      </Section>
    </Screen>
  );
}
