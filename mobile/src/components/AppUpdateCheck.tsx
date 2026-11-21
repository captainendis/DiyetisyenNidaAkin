// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Mağazada yeni sürüm varsa uyarır (görünmez bileşen; _layout.tsx).
 *  - Android: Google Play uygulama içi güncelleme (Play Core). "Güncelle" Play'in kendi akışını açar; Play izin
 *    veriyorsa tam ekran (immediate), değilse arka planda indirip bitince uygulamayı yeniden başlatır (flexible).
 *  - iOS: App Store'daki sürümle karşılaştırır; "Güncelle" App Store sayfasını açar.
 *  - Açılışta ve uygulama öne her geldiğinde en fazla 6 saatte bir sorulur. "Sonra" 24 saat ertelenir.
 *  - Play Console'da sürüm önceliği yüksek verilen (IMMEDIATE) güncellemeler ertelenemez.
 * Mağazadan kurulmamış derlemelerde (geliştirme, doğrudan APK) kontrol sessizce başarısız olur.
 */
import { checkForUpdate, startUpdate, type UpdateInfo } from 'expo-in-app-updates';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useRef, useState } from 'react';
import { AppState, Platform, View } from 'react-native';
import { Button, Sheet, T } from '@/components/ui';
import { space } from '@/theme';

const CHECK_EVERY_MS = 6 * 3600_000;
const SNOOZE_MS = 24 * 3600_000;
const SNOOZE_KEY = 'na.update.snoozedUntil.v1';
const supported = Platform.OS === 'android' || Platform.OS === 'ios';

async function snoozedNow() {
  try {
    return Number((await SecureStore.getItemAsync(SNOOZE_KEY)) ?? 0) > Date.now();
  } catch {
    return false;
  }
}

export function AppUpdateCheck() {
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [starting, setStarting] = useState(false);
  const lastCheck = useRef(0);

  useEffect(() => {
    if (!supported || __DEV__) return;
    const run = async () => {
      if (Date.now() - lastCheck.current < CHECK_EVERY_MS) return;
      lastCheck.current = Date.now();
      try {
        const r = await checkForUpdate();
        if (!r.updateAvailable) return;
        const mandatory = r.serverUpdateType === 'IMMEDIATE';
        if (!mandatory && (await snoozedNow())) return;
        setInfo(r);
      } catch (e) {
        console.warn('[update] mağaza sürümü kontrol edilemedi', e);
      }
    };
    void run();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void run();
    });
    return () => sub.remove();
  }, []);

  if (!info) return null;
  const mandatory = info.serverUpdateType === 'IMMEDIATE';
  const store = Platform.OS === 'ios' ? 'App Store' : 'Google Play';

  const later = () => {
    if (mandatory) return;
    void SecureStore.setItemAsync(SNOOZE_KEY, String(Date.now() + SNOOZE_MS)).catch(() => {});
    setInfo(null);
  };

  const update = async () => {
    setStarting(true);
    try {
      const started = await startUpdate(Platform.OS === 'android' ? !!info.immediateAllowed : undefined);
      if (started && !mandatory) setInfo(null);
    } catch (e) {
      console.warn('[update] güncelleme başlatılamadı', e);
    } finally {
      setStarting(false);
    }
  };

  return (
    <Sheet visible onClose={later} title="Yeni sürüm yayımlandı" subtitle={info.storeVersion ? `Sürüm ${info.storeVersion}` : undefined}>
      <T>
        {mandatory
          ? `Uygulamayı kullanmaya devam etmek için ${store}'dan güncellemek gerekiyor. Güncelleme birkaç dakika sürer; kayıtlı bilgiler etkilenmez.`
          : `Uygulamanın yeni sürümü ${store}'da. Güncelleme birkaç dakika sürer; kayıtlı bilgiler etkilenmez.`}
      </T>
      <View style={{ gap: space.sm, marginTop: space.sm }}>
        <Button title={starting ? 'Açılıyor…' : 'Güncelle'} loading={starting} onPress={() => void update()} full />
        {mandatory ? null : <Button title="Sonra" variant="secondary" onPress={later} full />}
      </View>
    </Sheet>
  );
}
