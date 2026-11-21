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
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { queryClient } from './query';
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
  role: 'ADMIN' | 'DIETITIAN' | 'ASSISTANT';
  permissions: Permission[];
  csrfToken: string;
}

export interface ClientMe {
  firstName: string;
  lastName: string;
  email: string;
  csrfToken: string;
  programs: { nutrition: boolean; pilates: boolean };
}

type Stored = { kind: 'staff' | 'client'; token: string; csrf: string };

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
}

const Ctx = createContext<AuthApi | null>(null);

async function readStored(): Promise<Stored | null> {
  try {
    const raw = await SecureStore.getItemAsync(STORE_KEY);
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    return null;
  }
}

async function writeStored(s: Stored | null) {
  try {
    if (s) await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(s));
    else await SecureStore.deleteItemAsync(STORE_KEY);
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
  const stored = useRef<Stored | null>(null);

  const signOutLocal = useCallback(async () => {
    stored.current = null;
    applySession(null);
    await writeStored(null);
    queryClient.clear();
    setState({ status: 'signedOut' });
  }, []);

  /** Kayıtlı token ile kimliği doğrular */
  const hydrate = useCallback(
    async (s: Stored) => {
      applySession(s);
      if (s.kind === 'staff') {
        const res = await api.get<{ user: StaffUser; demoMode: boolean }>('/auth/me');
        api.setCsrfToken(res.user.csrfToken);
        stored.current = { ...s, csrf: res.user.csrfToken };
        setState({ status: 'staff', user: res.user, demoMode: res.demoMode });
      } else {
        const res = await portalApi.get<{ me: ClientMe }>('/auth/me');
        portalApi.setCsrfToken(res.me.csrfToken);
        stored.current = { ...s, csrf: res.me.csrfToken };
        setState({ status: 'client', me: res.me });
      }
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
      } catch (e) {
        // Ağ hatasında oturumu silme: kullanıcı çevrimdışı olabilir; yeniden denemesi için giriş ekranı yerine hata
        const status = (e as { status?: number }).status;
        if (status === 401 || status === 403) await signOutLocal();
        else setState({ status: 'signedOut' });
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
      await hydrate({ kind, token, csrf });
    },
    [hydrate],
  );

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
    () => ({ state, loginStaff, loginClient, adoptSession, logout, refresh, can }),
    [state, loginStaff, loginClient, adoptSession, logout, refresh, can],
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
