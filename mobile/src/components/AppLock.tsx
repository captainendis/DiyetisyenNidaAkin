// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Uygulama kilidi (Face ID / Touch ID / parmak izi). Açıkken, uygulama 2 dakikadan uzun arka planda kaldıysa
 * ya da yeni açıldıysa içerik gizlenir ve biyometrik doğrulama istenir. Klinik veriler açık ekranda kalmasın diye
 * personel için önerilir; Ayarlar ve Hesap ekranlarından açılıp kapatılır.
 */
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { useAuth } from '@/lib/auth';
import { colors, space } from '@/theme';
import { Button } from './ui/Button';
import { Icon } from './ui/Icon';
import { T } from './ui/Text';

const KEY = 'na.applock.v1';
const GRACE_MS = 2 * 60_000;

interface LockApi {
  enabled: boolean;
  available: boolean;
  setEnabled: (v: boolean) => Promise<boolean>;
}
const Ctx = createContext<LockApi>({ enabled: false, available: false, setEnabled: async () => false });
export const useAppLock = () => useContext(Ctx);

export function AppLock({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  const signedIn = state.status === 'staff' || state.status === 'client';
  const [enabled, setEnabledState] = useState(false);
  const [available, setAvailable] = useState(false);
  const [locked, setLocked] = useState(false);
  const [checked, setChecked] = useState(false);
  const bgAt = useRef<number | null>(null);

  const unlock = useCallback(async () => {
    const r = await LocalAuthentication.authenticateAsync({ promptMessage: 'Nida Akın — kilidi aç', cancelLabel: 'Vazgeç', fallbackLabel: 'Cihaz şifresi' });
    if (r.success) setLocked(false);
  }, []);

  useEffect(() => {
    (async () => {
      const hw = (await LocalAuthentication.hasHardwareAsync().catch(() => false)) && (await LocalAuthentication.isEnrolledAsync().catch(() => false));
      setAvailable(hw);
      const on = hw && (await SecureStore.getItemAsync(KEY).catch(() => null)) === '1';
      setEnabledState(on);
      setLocked(on);
      setChecked(true);
    })();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') bgAt.current = Date.now();
      if (s === 'active' && bgAt.current && Date.now() - bgAt.current > GRACE_MS && enabled) setLocked(true);
    });
    return () => sub.remove();
  }, [enabled]);

  useEffect(() => {
    if (locked && signedIn) void unlock();
  }, [locked, signedIn, unlock]);

  const setEnabled = useCallback(async (v: boolean) => {
    if (v) {
      const r = await LocalAuthentication.authenticateAsync({ promptMessage: 'Uygulama kilidini aç' });
      if (!r.success) return false;
    }
    await SecureStore.setItemAsync(KEY, v ? '1' : '0').catch(() => {});
    setEnabledState(v);
    return true;
  }, []);

  if (!checked) return null;
  return (
    <Ctx.Provider value={{ enabled, available, setEnabled }}>
      {children}
      {locked && signedIn ? (
        <View style={[StyleSheet.absoluteFill, styles.lock]}>
          <Icon name="lock" size={32} color={colors.gold} />
          <T variant="title" color={colors.cream}>Uygulama kilitli</T>
          <T center color={colors.mist}>Devam etmek için kimliğini doğrula.</T>
          <Button title="Kilidi aç" variant="rose" icon="unlock" onPress={unlock} />
        </View>
      ) : null}
    </Ctx.Provider>
  );
}

const styles = StyleSheet.create({
  lock: { backgroundColor: colors.espresso, alignItems: 'center', justifyContent: 'center', gap: space.lg, padding: space.xxl },
});
