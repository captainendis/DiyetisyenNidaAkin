// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Randevu talebi (web: /randevu — AppointmentPage + BookingForm). `?tur=pilates` pilates ders talebiyle açılır.
 * Herkese açık talep uçlarını kullanır; başarıda Hesabım sorguları (['portal']) tazelenir.
 */
import { Stack, useLocalSearchParams } from 'expo-router';
import { ErrorView, Loading } from '@/components/ui';
import { BK, BookingFlow, type BookingSite } from '@/features/booking';
import { api } from '@/lib/api';
import { useApiQuery } from '@/lib/query';

export default function BookingScreen() {
  const { tur } = useLocalSearchParams<{ tur?: string }>();
  const kind = tur === 'pilates' ? 'PILATES' : 'CONSULTATION';
  const site = useApiQuery(BK.site, () => api.get<BookingSite>('/public/site'));

  return (
    <>
      <Stack.Screen options={{ title: 'Randevu talebi' }} />
      {site.data ? (
        <BookingFlow key={kind} site={site.data} initialKind={kind} />
      ) : site.error ? (
        <ErrorView error={site.error} onRetry={() => void site.refetch()} />
      ) : (
        <Loading />
      )}
    </>
  );
}
