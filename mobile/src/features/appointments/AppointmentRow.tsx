// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Randevu satırı (liste, ajanda, danışan detayı) + durum rozeti */
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { APPOINTMENT_STATUS_LABEL, type AppointmentStatus } from '@shared/constants';
import { minutesOf, timeOf } from '@shared/time';
import { Badge, Icon, T } from '@/components/ui';
import { formatDayStr } from '@/lib/format';
import { colors, fonts, space } from '@/theme';
import { appointmentTypeLabel, displayName, STATUS_TONE, type AppointmentDTO } from './types';

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  return <Badge label={APPOINTMENT_STATUS_LABEL[status]} tone={STATUS_TONE[status]} />;
}

/** Randevuya benzer her nesne (danışan detayındaki özet kayıtlar dahil) */
export type AppointmentLike = Pick<AppointmentDTO, 'id' | 'status' | 'date' | 'time' | 'contactName'> &
  Partial<Pick<AppointmentDTO, 'client' | 'durationMinutes' | 'kind' | 'pilatesFormat' | 'meetingType' | 'service'>>;

/**
 * Randevu satırı. `showDate`: saat sütununun altında tarih (liste görünümü). `highlight`: "Sıradaki" işareti.
 * Kart içinde art arda kullanılır; `last` alt çizgiyi kaldırır.
 */
export function AppointmentRow({
  appointment: a,
  onPress,
  showDate,
  highlight,
  last,
  subtitle,
  action,
}: {
  appointment: AppointmentLike;
  onPress?: () => void;
  showDate?: boolean;
  highlight?: boolean;
  last?: boolean;
  subtitle?: string;
  /** Satır sonunda ek işlem (ör. hızlı onay butonu) */
  action?: ReactNode;
}) {
  const end = a.time && a.durationMinutes ? timeOf(minutesOf(a.time) + a.durationMinutes) : null;
  // İptal / gelmedi: satır geri planda kalır ama metin AA kontrastını korur (opaklık yerine muted ton)
  const muted = a.status === 'CANCELLED' || a.status === 'NO_SHOW';
  const name = displayName({ client: a.client ?? null, contactName: a.contactName });
  const type = a.meetingType ? appointmentTypeLabel({ kind: a.kind ?? 'CONSULTATION', pilatesFormat: a.pilatesFormat ?? null, meetingType: a.meetingType }) : null;
  const sub = subtitle ?? [type, a.service?.title].filter(Boolean).join(' · ');
  const body = (
    <View style={[styles.row, !last && styles.line]}>
      <View style={styles.when}>
        {a.date ? (
          <>
            {showDate ? <T variant="caption" style={{ textTransform: 'capitalize' }}>{formatDayStr(a.date, 'd MMM ccc')}</T> : null}
            <T style={[styles.time, muted && { color: colors.muted }]}>{a.time ?? '—'}</T>
            {!showDate && end ? <T variant="caption">{end}</T> : null}
          </>
        ) : (
          <T variant="caption" center>Saat atanmadı</T>
        )}
      </View>
      <View style={[styles.bar, { backgroundColor: highlight ? colors.roseDeep : colors.line }]} />
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <T variant="subheading" numberOfLines={1} color={muted ? colors.muted : undefined} style={{ flexShrink: 1 }}>{name}</T>
          {highlight ? <Badge label="Sıradaki" tone="rose" /> : null}
        </View>
        {sub ? <T variant="caption" numberOfLines={1}>{sub}</T> : null}
        <StatusBadge status={a.status} />
      </View>
      {action}
      {onPress ? <Icon name="chevron-right" size={18} color={colors.mist} /> : null}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${name}, ${a.date ? `${formatDayStr(a.date, 'd MMMM')} ${a.time ?? ''}` : 'saat atanmadı'}, ${APPOINTMENT_STATUS_LABEL[a.status]}`} style={({ pressed }) => pressed && { backgroundColor: '#F8F4EE' }}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 12, paddingHorizontal: space.lg, minHeight: 64 },
  line: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  when: { width: 64, alignItems: 'flex-end' },
  time: { fontFamily: fonts.bold, fontSize: 16, color: colors.text, fontVariant: ['tabular-nums'] },
  bar: { width: 3, alignSelf: 'stretch', borderRadius: 2 },
});
