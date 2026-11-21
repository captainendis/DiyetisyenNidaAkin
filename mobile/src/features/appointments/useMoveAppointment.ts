// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Takvimde sürükle-bırak ile yeniden planlama — web'deki AppointmentsPage.onMove ile aynı onay metni, istek ve mesajlar.
 * PATCH /appointments/:id { date, time } — çakışma (CONFLICT), çalışma saati dışı (OUTSIDE_HOURS), geçmiş saat ve
 * sonuçlanmış randevu kontrollerini sunucu yapar; hata mesajı olduğu gibi gösterilir.
 */
import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';
import { confirm, useToast } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { formatDayStr } from '@/lib/format';
import { queryClient } from '@/lib/query';
import { APPOINTMENT_INVALIDATE, displayName, type AppointmentDTO } from './types';

const refresh = () => Promise.all(APPOINTMENT_INVALIDATE.map((k) => queryClient.invalidateQueries({ queryKey: k })));

/** true → taşındı; false → vazgeçildi ya da hata (blok eski yerine döner) */
export function useMoveAppointment() {
  const toast = useToast();
  return useCallback(
    async (a: AppointmentDTO, date: string, time: string): Promise<boolean> => {
      const ok = await confirm({
        title: 'Randevu saati değiştirilsin mi?',
        message:
          `${displayName(a)}\n` +
          `${formatDayStr(a.date!, 'd MMMM, cccc')} ${a.time} → ${formatDayStr(date, 'd MMMM, cccc')} ${time}\n\n` +
          'Çakışma ve çalışma saati kontrolü kayıt sırasında yapılır.',
        confirmText: 'Saati değiştir',
      });
      if (!ok) return false;
      try {
        await api.patch(`/appointments/${a.id}`, { date, time });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        toast(`Randevu taşındı · ${formatDayStr(date, 'd MMMM')} · ${time}`);
        void refresh();
        return true;
      } catch (e) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        toast(`Randevu taşınamadı: ${errorMessage(e)}`, 'error');
        void refresh();
        return false;
      }
    },
    [toast],
  );
}
