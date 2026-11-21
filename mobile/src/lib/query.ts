// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Veri katmanı: TanStack Query.
 *  - useApiQuery(key, fn): ekran verisi (çekip-yenile, odakta tazeleme)
 *  - useApiMutation(fn, { invalidate }): kayıt/güncelleme; başarıda ilgili sorguları tazeler
 * Sorgu anahtarları dizidir ve ilk öğe kaynak adıdır: ['clients'], ['clients', id], ['portal', 'plans'] …
 */
import { AppState, Platform } from 'react-native';
import * as Network from 'expo-network';
import { QueryClient, focusManager, onlineManager, useMutation, useQuery, type QueryKey, type UseQueryOptions } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { ApiError } from './api';
import { startOfflineCache } from './offline';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Çevrimdışı açılışta diskten gelen veriler 7 gün boyunca gösterilebilsin (offline.ts)
      gcTime: 7 * 864e5,
      retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
    },
    mutations: { retry: false },
  },
});

// Uygulama ön plana gelince tazele; bağlantı yokken sorgular hata vermek yerine bekler, gelince tazelenir
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (s) => focusManager.setFocused(s === 'active'));
  onlineManager.setEventListener((setOnline) => {
    const sub = Network.addNetworkStateListener((st) => setOnline(st.isConnected !== false && st.isInternetReachable !== false));
    return () => sub.remove();
  });
  startOfflineCache(queryClient);
}

export function useApiQuery<T>(key: QueryKey, fn: () => Promise<T>, opts: Omit<UseQueryOptions<T, ApiError>, 'queryKey' | 'queryFn'> = {}) {
  const q = useQuery<T, ApiError>({ queryKey: key, queryFn: fn, ...opts });
  // Çekip-yenile: yalnızca kullanıcı tetiklediğinde dönen gösterge
  const [refreshing, setRefreshing] = useState(false);
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await q.refetch();
    } finally {
      setRefreshing(false);
    }
  }, [q]);
  return { ...q, refreshing, refresh };
}

/**
 * Mutasyon. `invalidate`: başarıdan sonra tazelenecek sorgu anahtarı önekleri.
 * Hata alanları (422) `fieldErrors` içinde döner.
 */
export function useApiMutation<A, R>(fn: (args: A) => Promise<R>, opts: { invalidate?: QueryKey[]; onSuccess?: (r: R, a: A) => void } = {}) {
  const m = useMutation<R, ApiError, A>({
    mutationFn: fn,
    onSuccess: async (r, a) => {
      await Promise.all((opts.invalidate ?? []).map((k) => queryClient.invalidateQueries({ queryKey: k })));
      opts.onSuccess?.(r, a);
    },
  });
  return { ...m, fieldErrors: m.error?.fields ?? {} };
}
