// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Çevrimdışı kullanım: son açılan verilerin cihazda saklanması.
 *
 * Bilinçli olarak DAR kapsam (sağlık verisi, KVKK):
 *  - Danışan: kendi listeleri, tarifleri, randevuları, ölçümleri, mesajları (['portal', …] sorguları) —
 *    "Listen telefonunda" vaadi internetsiz de geçerli olsun diye.
 *  - Personel: yalnızca genel bakış ve randevu gündemi (['dashboard'], ['appointments']).
 *    Klinik notlar, ölçümler, dosyalar, planlar personel tarafında ASLA diske yazılmaz.
 * Dosya uygulamanın kendi korumalı alanında durur (iOS Data Protection / Android uygulama alanı);
 * çıkışta silinir. En fazla 7 gün saklanır; uygulama sürümü değişince geçersiz olur.
 */
import Constants from 'expo-constants';
import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import type { Query, QueryClient } from '@tanstack/react-query';

const FILE_NAME = 'na-offline-cache.json';
const MAX_AGE = 7 * 864e5;

/** Diske yazılabilecek sorgu kökleri */
const ALLOWED_ROOTS = new Set(['portal', 'dashboard', 'appointments']);

const file = () => new File(Paths.document, FILE_NAME);

/** AsyncStorage arayüzü — expo-file-system üzerinde (tek dosya) */
const storage = {
  getItem: async (): Promise<string | null> => {
    try {
      const f = file();
      return f.exists ? await f.text() : null;
    } catch {
      return null;
    }
  },
  setItem: async (_key: string, value: string) => {
    try {
      file().write(value);
    } catch {
      /* disk dolu vb. — önbellek isteğe bağlıdır */
    }
  },
  removeItem: async () => {
    try {
      const f = file();
      if (f.exists) f.delete();
    } catch {
      /* yok say */
    }
  },
};

export function shouldPersist(query: Query) {
  const root = query.queryKey[0];
  return query.state.status === 'success' && typeof root === 'string' && ALLOWED_ROOTS.has(root);
}

let started = false;

/** Uygulama açılışında bir kez: diskten geri yükle, sonra değişiklikleri yaz */
export function startOfflineCache(client: QueryClient) {
  if (started || Platform.OS === 'web') return;
  started = true;
  persistQueryClient({
    queryClient: client,
    persister: createAsyncStoragePersister({ storage, key: 'na.cache', throttleTime: 2000 }),
    maxAge: MAX_AGE,
    buster: Constants.expoConfig?.version ?? '1',
    dehydrateOptions: { shouldDehydrateQuery: shouldPersist },
  });
}

/** Çıkışta: diskteki önbelleği sil */
export async function clearOfflineCache() {
  await storage.removeItem();
}
