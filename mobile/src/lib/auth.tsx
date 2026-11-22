// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Oturum — tek uygulama, iki giriş:
 *  - "client": danışan (Hesabım) → /api/portal/*
 *  - "staff":  Nida Akın ve ekibi (Panel) → /api/*
 * Token cihazın güvenli deposunda (iOS Keychain / Android Keystore) saklanır; açılışta /me ile doğrulanır.
 * Sunucu 401 döndürürse (oturum süresi doldu, şifre değişti, hesap kapandı) oturum kapanır ve giriş ekranına dönülür.
 */
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { onlineManager } from '@tanstack/react-query';
import { queryClient } from './query';
import { clearOfflineCache } from './offline';
import { api, portalApi } from './api';

const STORE_KEY = 'na.session.v1';

export type Permission =
  | 'dashboard:read'
  | 'appointments:read'
  | 'appointments:write'
  | 'clients:read'
  | 'clients:write'
  | 'clients:delete'
  | 'clinical:read'
  | 'clinical:write'
  | 'services:write'
  | 'content:write'
  | 'availability:write'
  | 'reports:read'
  | 'settings:write'
  | 'users:manage'
  | 'audit:read'
  | 'portal:manage';

export interface StaffUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  salutation: string | null;
  role: 'ADMIN' | 'DIETITIAN' | 'ASSISTANT' | 'REVIEWER';
  permissions: Permission[];
  csrfToken: string;
}

export interface ClientMe {
  firstName: string;
  lastName: string;
  email: string;
  /** Danışan kaydındaki telefon (+90…) */
  phone: string | null;
  csrfToken: string;
  programs: { nutrition: boolean; pilates: boolean };
  /** Hesap ve veri silme talebinin tarihi (yoksa null; eski önbellekte olmayabilir) */
  deletionRequestedAt?: string | null;
}

/**
 * Güvenli depodaki oturum. `snapshot`: son doğrulanan kimlik (ad, izinler) — uygulama internetsiz açılırsa
 * oturum düşürülmeden bununla açılır; bağlantı gelince yeniden doğrulanır (sunucu 401 derse çıkış yapılır).
 */
type Stored = {
  kind: 'staff' | 'client';
  token: string;
  csrf: string;
  snapshot?: { user: StaffUser; demoMode: boolean } | { me: ClientMe };
};

export type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'staff'; user: StaffUser; demoMode: boolean }
  | { status: 'client'; me: ClientMe };

interface AuthApi {
  state: AuthState;
  loginStaff: (email: string, password: string) => Promise<void>;
  loginClient: (email: string, password: string) => Promise<void>;
  /** Şifre belirleme bağlantısı / şifre değişikliği sonrası sunucunun verdiği yeni token ile oturumu açar */
  adoptSession: (kind: 'staff' | 'client', token: string, csrf: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  /** Personel izni (danışan oturumunda daima false) */
  can: (perm: Permission) => boolean;
  /** Her yeni oturum token'ında artar (giriş, şifre değişikliği) — oturuma bağlı kayıtlar (bildirim) yenilensin */
  sessionEpoch: number;
  /** Uygulama internetsiz açıldı; kimlik son kayıtlı bilgiden gösteriliyor */
  offline: boolean;
}

const Ctx = createContext<AuthApi | null>(null);

/**
 * Çıkıştan ÖNCE (oturum hâlâ geçerliyken) çalışan kancalar — ör. anlık bildirim token'ını sunucudan silmek
 * (components/PushNotifications.tsx). Çıkışı en fazla birkaç saniye bekletir; hatalar yutulur.
 */
type LogoutHook = (kind: 'staff' | 'client') => Promise<void>;
const logoutHooks = new Set<LogoutHook>();
export function onBeforeLogout(fn: LogoutHook) {
  logoutHooks.add(fn);
  return () => void logoutHooks.delete(fn);
}
async function runLogoutHooks(kind: 'staff' | 'client') {
  const all = Promise.allSettled([...logoutHooks].map((fn) => fn(kind)));
  await Promise.race([all, new Promise((r) => setTimeout(r, 4000))]);
}

/** Web önizlemesi (yalnızca geliştirme/QA): güvenli depo yok → localStorage */
const store = {
  get: (): Promise<string | null> => (Platform.OS === 'web' ? Promise.resolve(globalThis.localStorage?.getItem(STORE_KEY) ?? null) : SecureStore.getItemAsync(STORE_KEY)),
  set: (v: string) => (Platform.OS === 'web' ? Promise.resolve(globalThis.localStorage?.setItem(STORE_KEY, v)) : SecureStore.setItemAsync(STORE_KEY, v)),
  del: () => (Platform.OS === 'web' ? Promise.resolve(globalThis.localStorage?.removeItem(STORE_KEY)) : SecureStore.deleteItemAsync(STORE_KEY)),
};

async function readStored(): Promise<Stored | null> {
  try {
    const raw = await store.get();
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    return null;
  }
}

async function writeStored(s: Stored | null) {
  try {
    if (s) await store.set(JSON.stringify(s));
    else await store.del();
  } catch {
    /* güvenli depo yoksa (web önizleme) oturum yalnızca bellekte kalır */
  }
}

function applySession(s: Stored | null) {
  api.setSession(s?.kind === 'staff' ? s.token : null, s?.kind === 'staff' ? s.csrf : null);
  portalApi.setSession(s?.kind === 'client' ? s.token : null, s?.kind === 'client' ? s.csrf : null);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  const [sessionEpoch, setSessionEpoch] = useState(0);
  const [offline, setOffline] = useState(false);
  const stored = useRef<Stored | null>(null);

  const signOutLocal = useCallback(async () => {
    stored.current = null;
    applySession(null);
    await writeStored(null);
    queryClient.clear();
    await clearOfflineCache();
    setOffline(false);
    setState({ status: 'signedOut' });
  }, []);

  /** Kayıtlı token ile kimliği doğrular */
  const hydrate = useCallback(
    async (s: Stored) => {
      applySession(s);
      if (s.kind === 'staff') {
        const res = await api.get<{ user: StaffUser; demoMode: boolean }>('/auth/me');
        api.setCsrfToken(res.user.csrfToken);
        stored.current = { kind: s.kind, token: s.token, csrf: res.user.csrfToken, snapshot: { user: res.user, demoMode: res.demoMode } };
        setState({ status: 'staff', user: res.user, demoMode: res.demoMode });
      } else {
        const res = await portalApi.get<{ me: ClientMe }>('/auth/me');
        portalApi.setCsrfToken(res.me.csrfToken);
        stored.current = { kind: s.kind, token: s.token, csrf: res.me.csrfToken, snapshot: { me: res.me } };
        setState({ status: 'client', me: res.me });
      }
      setOffline(false);
      await writeStored(stored.current);
    },
    [],
  );

  useEffect(() => {
    const onUnauthorized = () => void signOutLocal();
    api.setUnauthorizedHandler(onUnauthorized);
    portalApi.setUnauthorizedHandler(onUnauthorized);
    (async () => {
      const s = await readStored();
      if (!s) return setState({ status: 'signedOut' });
      try {
        await hydrate(s);
        setSessionEpoch((n) => n + 1);
      } catch (e) {
        const status = (e as { status?: number }).status;
        if (status === 401 || status === 403) return void (await signOutLocal());
        // Ağ hatası: oturumu silme — son kayıtlı kimlikle aç (çevrimdışı önbellekteki veriler görünür)
        const snap = s.snapshot;
        if (!snap) return setState({ status: 'signedOut' });
        stored.current = s;
        applySession(s);
        setOffline(true);
        setState('user' in snap ? { status: 'staff', user: snap.user, demoMode: snap.demoMode } : { status: 'client', me: snap.me });
      }
    })();
    return () => {
      api.setUnauthorizedHandler(null);
      portalApi.setUnauthorizedHandler(null);
    };
  }, [hydrate, signOutLocal]);

  const adoptSession = useCallback(
    async (kind: 'staff' | 'client', token: string, csrf: string) => {
      queryClient.clear();
      await clearOfflineCache();
      await hydrate({ kind, token, csrf });
      setSessionEpoch((n) => n + 1);
    },
    [hydrate],
  );

  // İnternetsiz açıldıysa: bağlantı gelince kimliği yeniden doğrula
  useEffect(() => {
    if (!offline) return;
    return onlineManager.subscribe((online) => {
      if (!online || !stored.current) return;
      hydrate(stored.current).then(() => setSessionEpoch((n) => n + 1)).catch(() => {
        /* 401 ise api istemcisinin oturum-düştü işleyicisi çıkış yapar; ağ hatasında tekrar beklenir */
      });
    });
  }, [offline, hydrate]);

  const loginStaff = useCallback(
    async (email: string, password: string) => {
      applySession(null);
      const res = await api.post<{ token?: string; csrfToken?: string }>('/auth/login', { email, password, remember: true });
      if (!res.token || !res.csrfToken) throw new Error('Sunucu mobil oturumu desteklemiyor. Lütfen sunucuyu güncelleyin.');
      await adoptSession('staff', res.token, res.csrfToken);
    },
    [adoptSession],
  );

  const loginClient = useCallback(
    async (email: string, password: string) => {
      applySession(null);
      const res = await portalApi.post<{ token?: string; csrfToken?: string }>('/auth/login', { email, password, remember: true });
      if (!res.token || !res.csrfToken) throw new Error('Sunucu mobil oturumu desteklemiyor. Lütfen sunucuyu güncelleyin.');
      await adoptSession('client', res.token, res.csrfToken);
    },
    [adoptSession],
  );

  const logout = useCallback(async () => {
    const s = stored.current;
    if (s) await runLogoutHooks(s.kind);
    try {
      if (s?.kind === 'staff') await api.post('/auth/logout');
      else if (s?.kind === 'client') await portalApi.post('/auth/logout');
    } catch {
      /* sunucuya ulaşılamasa da yerel oturum kapanır */
    }
    await signOutLocal();
  }, [signOutLocal]);

  const refresh = useCallback(async () => {
    if (stored.current) await hydrate(stored.current);
  }, [hydrate]);

  const can = useCallback((perm: Permission) => state.status === 'staff' && state.user.permissions.includes(perm), [state]);

  const value = useMemo<AuthApi>(
    () => ({ state, loginStaff, loginClient, adoptSession, logout, refresh, can, sessionEpoch, offline }),
    [state, loginStaff, loginClient, adoptSession, logout, refresh, can, sessionEpoch, offline],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth, AuthProvider içinde kullanılmalı');
  return v;
}

/** Personel ekranlarında: oturum açık personel (aksi hâlde hata) */
export function useStaff() {
  const { state, can } = useAuth();
  if (state.status !== 'staff') throw new Error('Personel oturumu yok');
  return { user: state.user, demoMode: state.demoMode, can };
}

/** Danışan ekranlarında: oturum açık danışan */
export function useClient() {
  const { state } = useAuth();
  if (state.status !== 'client') throw new Error('Danışan oturumu yok');
  return state.me;
}
