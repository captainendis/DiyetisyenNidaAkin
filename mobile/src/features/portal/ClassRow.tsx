// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Tek pilates dersi satırı: tarih, saat, ders adı ve danışanın katılım durumu (diğer katılımcılar gösterilmez) */
import { View } from 'react-native';
import { CLASS_ATTENDANCE_LABEL } from '@shared/constants';
import type { PortalClassSession } from '@shared/classes';
import { Badge, ListItem, T } from '@/components/ui';
import { formatDate, formatTime } from '@/lib/format';
import { colors } from '@/theme';
import { CLASS_TONE } from './util';

export function ClassRow({ s, last }: { s: PortalClassSession; last?: boolean }) {
  const cancelled = s.status === 'CANCELLED';
  return (
    <ListItem
      last={last}
      title={
        <View style={{ opacity: cancelled ? 0.6 : 1 }}>
          <T variant="subheading" style={cancelled ? { textDecorationLine: 'line-through' } : undefined}>{formatDate(s.startsAt)}</T>
          <T variant="caption" color={colors.cocoa}>{formatTime(s.startsAt)}–{formatTime(s.endsAt)} · {s.title}</T>
        </View>
      }
      right={<Badge label={cancelled ? 'Ders iptal' : s.myStatus === 'BOOKED' ? 'Kaydın var' : CLASS_ATTENDANCE_LABEL[s.myStatus]} tone={cancelled ? 'danger' : (CLASS_TONE[s.myStatus] ?? 'neutral')} />}
    />
  );
}
