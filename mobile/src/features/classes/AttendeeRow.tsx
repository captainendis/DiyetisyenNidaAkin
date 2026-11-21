// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Ders katılımcısı satırı: ad, üyelik türü, yoklama düğmeleri (katıldı / gelmedi / haber verdi), dersten çıkar */
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Icon, T } from '@/components/ui';
import { colors, fonts, radius, space, toneColors } from '@/theme';
import { CLASS_ATTENDANCE_LABEL, CLASS_SEAT_HOLDING, type ClassAttendanceStatus } from '@shared/constants';
import type { ClassAttendeeDTO } from '@shared/classes';
import { ATTENDANCE_TONE, AttendanceBadge, clientName } from './shared';

const MARKS: ClassAttendanceStatus[] = ['ATTENDED', 'NO_SHOW', 'EXCUSED'];

export function AttendeeRow({
  a,
  editable,
  started,
  busy,
  last,
  onMark,
  onRemove,
}: {
  a: ClassAttendeeDTO;
  editable: boolean;
  started: boolean;
  busy: boolean;
  last?: boolean;
  onMark: (status: ClassAttendanceStatus) => void;
  onRemove: () => void;
}) {
  const name = clientName(a.client);
  const freed = !CLASS_SEAT_HOLDING.includes(a.status);
  return (
    <View style={[styles.row, !last && styles.line]}>
      <View style={styles.head}>
        <Pressable
          onPress={() => router.push(`/panel/danisanlar/${a.clientId}`)}
          accessibilityRole="link"
          accessibilityLabel={`${name} danışan kartı`}
          style={{ flex: 1, gap: 2 }}
        >
          <T variant="subheading" color={freed ? colors.muted : undefined} style={freed ? { textDecorationLine: 'line-through' } : undefined}>
            {name}
          </T>
          <T variant="caption">
            {a.isMember ? 'Grup üyesi' : 'Telafi / misafir'}
            {a.status === 'BOOKED' ? ' · Kayıtlı' : ''}
          </T>
        </Pressable>
        {busy ? <ActivityIndicator color={colors.gold} /> : null}
        {editable ? (
          <Pressable onPress={onRemove} hitSlop={8} accessibilityRole="button" accessibilityLabel={`${name} kişisini dersten çıkar`} style={styles.remove}>
            <Icon name="user-minus" size={18} color={colors.dangerInk} />
          </Pressable>
        ) : (
          <AttendanceBadge status={a.status} />
        )}
      </View>
      {editable ? (
        <View style={styles.marks} accessibilityRole="radiogroup" accessibilityLabel={`${name} yoklama`}>
          {MARKS.map((m) => {
            const locked = m !== 'EXCUSED' && !started;
            const on = a.status === m;
            const tone = toneColors[ATTENDANCE_TONE[m]];
            return (
              <Pressable
                key={m}
                disabled={locked || busy}
                onPress={() => onMark(on ? 'BOOKED' : m)}
                accessibilityRole="radio"
                accessibilityState={{ checked: on, disabled: locked || busy }}
                accessibilityHint={locked ? 'Ders başladıktan sonra işaretlenebilir' : on ? 'Tekrar dokunursanız “kayıtlı” durumuna döner' : undefined}
                style={[styles.mark, on && { backgroundColor: tone.bg, borderColor: tone.fg }, locked && { opacity: 0.4 }]}
              >
                {on ? <Icon name="check" size={14} color={tone.fg} /> : null}
                <T style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: on ? tone.fg : colors.cocoa }} numberOfLines={1}>
                  {CLASS_ATTENDANCE_LABEL[m]}
                </T>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: space.md, paddingHorizontal: space.lg, gap: space.sm },
  line: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  remove: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.dangerBg },
  marks: { flexDirection: 'row', gap: space.sm },
  mark: {
    flex: 1,
    minHeight: 40,
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 6,
  },
});
