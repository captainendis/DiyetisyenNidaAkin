// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Gruba haftalık ders programı ekler: gün + saat seçimi, başlangıç, hafta sayısı.
 * Uygun olmayan tarihler atlanır ve listelenir. (Web: RecurringModal)
 */
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Card, DateField, Empty, FieldRow, Form, Icon, KeyValue, Notice, QueryView, Screen, Section, SelectField, SwitchField, T, TextField, TimeField, useToast } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { formatDayStr, todayStr } from '@/lib/format';
import { useStaff } from '@/lib/auth';
import { queryClient } from '@/lib/query';
import { colors, radius, space } from '@/theme';
import { WEEKDAY_LABEL } from '@shared/constants';
import { useGroups } from '@/features/classes/GroupList';
import type { ClassGroupDTO, ClassRecurringResult } from '@/features/classes/shared';

const DAYS = [1, 2, 3, 4, 5, 6, 7];

export default function RecurringScreen() {
  const { can } = useStaff();
  const groups = useGroups();
  if (!can('appointments:write')) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Ders programı ekle' }} />
        <Empty icon="lock" title="Yetkiniz yok" text="Ders eklemek için yazma yetkisi gerekir." />
      </Screen>
    );
  }
  return (
    <>
      <Stack.Screen options={{ title: 'Ders programı ekle' }} />
      <QueryView query={groups}>{({ items }) => <RecurringForm groups={items} />}</QueryView>
    </>
  );
}

function RecurringForm({ groups }: { groups: ClassGroupDTO[] }) {
  const params = useLocalSearchParams<{ groupId?: string }>();
  const toast = useToast();
  const choices = groups.filter((g) => g.isActive);
  const [groupId, setGroupId] = useState(() => (params.groupId && choices.some((g) => g.id === params.groupId) ? params.groupId : choices[0]?.id ?? ''));
  const group = choices.find((g) => g.id === groupId) ?? null;
  const [times, setTimes] = useState<Record<number, string>>({});
  const [startDate, setStartDate] = useState(todayStr());
  const [weeks, setWeeks] = useState('8');
  const [duration, setDuration] = useState('');
  const [outside, setOutside] = useState(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ClassRecurringResult | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!group) return;
    // Mevcut düzen varsa onu öner
    setTimes(Object.fromEntries(group.pattern.map((p) => [p.weekday, p.time])));
    setDuration(String(group.defaultDurationMinutes));
    setError('');
  }, [group?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!choices.length) {
    return (
      <Screen>
        <Empty
          icon="users"
          title="Aktif grup yok"
          text="Ders programı eklemek için önce bir pilates grubu oluşturun."
          action={<Button title="Yeni grup" icon="plus" onPress={() => router.replace('/panel/pilates/grup/duzenle')} />}
        />
      </Screen>
    );
  }

  const toggle = (d: number) =>
    setTimes((t) => {
      const next = { ...t };
      if (d in next) delete next[d];
      else next[d] = Object.values(t)[0] ?? '18:00';
      return next;
    });

  const slots = Object.entries(times).map(([weekday, time]) => ({ weekday: Number(weekday), time }));
  const estimate = slots.length * (Number(weeks) || 0);

  const submit = async () => {
    if (!group) return;
    if (!slots.length) return setError('En az bir gün seçin');
    if (slots.some((s) => !/^\d{2}:\d{2}$/.test(s.time))) return setError('Her gün için saat girin');
    setError('');
    setPending(true);
    try {
      const r = await api.post<ClassRecurringResult>(`/classes/groups/${group.id}/recurring`, {
        slots,
        startDate,
        weeks: Number(weeks),
        durationMinutes: Number(duration) || undefined,
        allowOutsideHours: outside,
      });
      setResult(r);
      if (r.created) toast(`${r.created} ders eklendi · ${group.name}`);
      void queryClient.invalidateQueries({ queryKey: ['classes'] });
    } catch (e) {
      const fields = (e as { fields?: Record<string, string> }).fields ?? {};
      setError(Object.values(fields)[0] ?? errorMessage(e));
    } finally {
      setPending(false);
    }
  };

  if (result) {
    return (
      <Screen footer={<Button title="Tamam" full onPress={() => router.back()} />}>
        <Notice tone={result.created ? 'success' : 'warning'} icon="calendar" text={`${result.created} ders takvime eklendi.`} />
        {result.skipped.length > 0 ? (
          <Section title={`Atlanan tarihler (${result.skipped.length})`} style={{ marginTop: space.xl }}>
            <Card>
              {result.skipped.map((s, i) => (
                <KeyValue key={`${s.date}${s.time}`} label={`${formatDayStr(s.date, 'd MMMM cccc')} ${s.time}`} value={s.reason} last={i === result.skipped.length - 1} />
              ))}
            </Card>
            <T variant="caption" style={{ marginTop: space.sm }}>Bu tarihler için “Tek ders ekle” ile farklı bir saat seçebilirsiniz.</T>
          </Section>
        ) : null}
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <Button title={estimate ? `${estimate} ders oluştur` : 'Dersleri oluştur'} icon="calendar" full onPress={() => void submit()} loading={pending} disabled={!slots.length || !group} />
      }
    >
      <Form>
        <SelectField
          label="Grup"
          value={groupId}
          onChange={setGroupId}
          options={choices.map((g) => ({ value: g.id, label: `${g.name} (${g.members.length}/${g.capacity})` }))}
          help={group ? `${group.members.length}/${group.capacity} üye derslere otomatik eklenir` : undefined}
        />
        <View style={{ gap: space.sm }}>
          <T variant="label">Günler ve saatler</T>
          {DAYS.map((d) => {
            const on = d in times;
            return (
              <View key={d} style={[styles.day, on && styles.dayOn]}>
                <Pressable
                  onPress={() => toggle(d)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={WEEKDAY_LABEL[d]}
                  style={styles.dayHead}
                >
                  <View style={[styles.box, on && styles.boxOn]}>{on ? <Icon name="check" size={14} color={colors.cream} /> : null}</View>
                  <T variant="subheading" style={{ flex: 1 }}>{WEEKDAY_LABEL[d]}</T>
                </Pressable>
                {on ? (
                  <View style={{ width: 150 }}>
                    <TimeField label={undefined} value={times[d]} onChange={(v) => setTimes((t) => ({ ...t, [d]: v }))} placeholder="Saat" />
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
        <DateField label="Başlangıç" value={startDate} onChange={setStartDate} minimumDate={todayStr()} />
        <FieldRow>
          <TextField label="Kaç hafta" value={weeks} onChange={(v) => setWeeks(v.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={2} help="En fazla 26 hafta" />
          <TextField label="Süre (dk)" value={duration} onChange={(v) => setDuration(v.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={3} />
        </FieldRow>
        <SwitchField
          label="Çalışma saatleri dışında olabilir"
          help="Pilates saatleri danışmanlık saatlerinden farklıysa açın. Randevu ve diğer derslerle çakışma yine kontrol edilir."
          value={outside}
          onChange={setOutside}
        />
        {error ? <Notice tone="danger" text={error} /> : null}
        <T variant="caption">Dolu ya da kapalı günlere denk gelen dersler atlanır ve size listelenir; diğerleri oluşturulur.</T>
      </Form>
    </Screen>
  );
}

const styles = StyleSheet.create({
  day: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, paddingVertical: 6, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, minHeight: 56 },
  dayOn: { borderColor: colors.gold, backgroundColor: '#FBF7F0' },
  dayHead: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 44 },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.mist, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: colors.espresso, borderColor: colors.espresso },
});
