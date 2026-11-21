// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Takvim değişikliğinden etkilenen onaylı randevular (engellenmez, uyarılır) */
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Button, Icon, T } from '@/components/ui';
import { formatDayStr } from '@/lib/format';
import { colors, radius, space } from '@/theme';
import type { AffectedAppointment } from './types';

export function AffectedWarning({ items, onDismiss }: { items: AffectedAppointment[]; onDismiss: () => void }) {
  if (!items.length) return null;
  return (
    <View accessibilityRole="alert" style={{ backgroundColor: colors.warningBg, borderRadius: radius.md, padding: space.lg, gap: space.sm, marginBottom: space.xl }}>
      <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start' }}>
        <Icon name="alert-triangle" size={18} color={colors.warningInk} />
        <View style={{ flex: 1, gap: 4 }}>
          <T variant="label" color={colors.warningInk}>{items.length} onaylı randevu yeni takvimin dışında kalıyor</T>
          <T variant="caption" color={colors.warningInk}>
            Değişiklik kaydedildi, ancak bu randevular otomatik olarak iptal edilmedi. Danışanlarla iletişime geçip randevuları yeniden planlayın veya iptal edin.
          </T>
        </View>
      </View>
      {items.slice(0, 10).map((a) => (
        <Pressable key={a.appointmentId} onPress={() => router.push(`/panel/randevular/${a.appointmentId}`)} accessibilityRole="link" style={{ minHeight: 36, justifyContent: 'center', paddingLeft: 30 }}>
          <T variant="label" color={colors.cocoa} style={{ textDecorationLine: 'underline' }}>
            {formatDayStr(a.date, 'd MMMM cccc')} · {a.time} — {a.contactName}
          </T>
        </Pressable>
      ))}
      {items.length > 10 ? <T variant="caption" color={colors.warningInk} style={{ paddingLeft: 30 }}>ve {items.length - 10} randevu daha</T> : null}
      <Button title="Kapat" variant="ghost" size="sm" style={{ alignSelf: 'flex-end' }} onPress={onDismiss} />
    </View>
  );
}
