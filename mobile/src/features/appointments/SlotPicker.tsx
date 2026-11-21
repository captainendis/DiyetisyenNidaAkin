// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Seçilen gün için boş/dolu zaman dilimleri. Çalışma saatleri dışı modda serbest saat seçimi. */
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { T, TimeField } from '@/components/ui';
import { api } from '@/lib/api';
import { useApiQuery } from '@/lib/query';
import { colors, fonts, radius, space } from '@/theme';
import type { SlotDTO } from './types';

export function SlotPicker({
  date,
  duration,
  ignoreId,
  value,
  onChange,
  freeTime = false,
  error,
}: {
  date: string;
  duration?: number;
  ignoreId?: string;
  value: string;
  onChange: (t: string) => void;
  freeTime?: boolean;
  error?: string;
}) {
  const q = useApiQuery(
    ['appointments', 'slots', date, duration ?? null, ignoreId ?? null],
    () => api.get<{ closedReason: string | null; slots: SlotDTO[] }>('/appointments/slots', { date, duration, ignoreId }),
    { enabled: !!date && !freeTime, staleTime: 0 },
  );

  if (freeTime) {
    return <TimeField label="Saat" value={value} onChange={onChange} error={error} help="Çalışma saatleri dışı özel randevu; çakışma kontrolü yine yapılır." />;
  }
  let content;
  if (!date) content = <T muted>Önce bir gün seçin.</T>;
  else if (q.error) content = <T color={colors.dangerInk}>Saatler yüklenemedi.</T>;
  else if (!q.data) content = <ActivityIndicator color={colors.gold} style={{ alignSelf: 'flex-start' }} />;
  else if (!q.data.slots.length)
    content = (
      <View style={styles.empty}>
        <T variant="label">{q.data.closedReason ?? 'Bu gün için uygun saat yok.'}</T>
        <T variant="caption">Çalışma takvimini düzenleyebilir veya “Çalışma saatleri dışında” seçeneğiyle özel randevu oluşturabilirsiniz.</T>
      </View>
    );
  else
    content = (
      <View style={styles.grid} accessibilityRole="radiogroup" accessibilityLabel="Saat seçin">
        {q.data.slots.map((s) => {
          const sel = value === s.time;
          return (
            <Pressable
              key={s.time}
              disabled={!s.available}
              onPress={() => onChange(s.time)}
              accessibilityRole="radio"
              accessibilityState={{ checked: sel, disabled: !s.available }}
              accessibilityLabel={s.available ? `${s.time}–${s.endTime}` : `${s.time} dolu`}
              style={[styles.slot, sel && styles.sel, !s.available && styles.off]}
            >
              <T style={[styles.slotText, sel && { color: colors.cream }, !s.available && { color: colors.mist, textDecorationLine: 'line-through' }]}>{s.time}</T>
            </Pressable>
          );
        })}
      </View>
    );
  return (
    <View style={{ gap: 6 }}>
      <T variant="label">Saat</T>
      {content}
      {error ? <T variant="caption" color={colors.dangerInk}>{error}</T> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  slot: { width: '23%', minHeight: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  sel: { backgroundColor: colors.espresso, borderColor: colors.espresso },
  off: { backgroundColor: '#EFE8DD', borderColor: 'transparent' },
  slotText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text, fontVariant: ['tabular-nums'] },
  empty: { backgroundColor: '#EFE8DD', borderRadius: radius.md, padding: space.md, gap: 4 },
});
