// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Panel kimlik doğrulama bağlamı: kullanıcı, izinler, CSRF token, okunmamış bildirim sayısı */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Navigate, useLocation, useNavigate } from '@/lib/router';
import { api, ApiError, setCsrfToken, setUnauthorizedHandler } from '@/lib/api';

export type Permission =
  | 'dashboard:read' | 'appointments:read' | 'appointments:write' | 'clients:read' | 'clients:write' | 'clients:delete'
  | 'clinical:read' | 'clinical:write' | 'services:write' | 'content:write' | 'availability:write' | 'reports:read'
  | 'settings:write' | 'users:manage' | 'audit:read' | 'portal:manage';

export interface PanelUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  salutation: string | null;
  role: 'ADMIN' | 'DIETITIAN' | 'ASSISTANT' | 'REVIEWER';
  permissions: Permission[];
  csrfToken: string;
}

interface Ctx {
  user: PanelUser | null;
  loading: boolean;
  demoMode: boolean;
  can: (p: Permission) => boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  unreadCount: number;
  refreshUnread: () => void;
}

const AuthCtx = createContext<Ctx | null>(null);

export function PanelAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PanelUser | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnread] = useState(0);
  const navigate = useNavigate();

  const refresh = useCallback(async () => {
    try {
      const res = await api.get<{ user: PanelUser; demoMode: boolean }>('/auth/me');
      setUser(res.user);
      setDemoMode(res.demoMode);
      setCsrfToken(res.user.csrfToken);
    } catch (e) {
      if (!(e instanceof ApiError) || e.status === 401) {
        setUser(null);
        setCsrfToken(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshUnread = useCallback(() => {
    api
      .get<{ count: number }>('/notifications/unread-count')
      .then((r) => setUnread(r.count))
      .catch(() => {});
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      setCsrfToken(null);
      if (window.location.pathname.startsWith('/panel') && !window.location.pathname.startsWith('/panel/giris')) {
        navigate(`/panel/giris?next=${encodeURIComponent(window.location.pathname + window.location.search)}`, { replace: true });
      }
    });
    return () => setUnauthorizedHandler(null);
  }, [navigate]);

  // Okunmamış bildirim sayacı: 30 sn'de bir ve sekme odaklandığında
  useEffect(() => {
    if (!user) return;
    refreshUnread();
    const t = setInterval(refreshUnread, 30_000);
    const onFocus = () => refreshUnread();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener('focus', onFocus);
    };
  }, [user, refreshUnread]);

  const logout = useCallback(async () => {
    await api.post('/auth/logout').catch(() => {});
    setUser(null);
    setCsrfToken(null);
    navigate('/panel/giris', { replace: true });
  }, [navigate]);

  const value = useMemo<Ctx>(
    () => ({ user, loading, demoMode, can: (p) => !!user?.permissions.includes(p), refresh, logout, unreadCount, refreshUnread }),
    [user, loading, demoMode, refresh, logout, unreadCount, refreshUnread],
  );
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function usePanelAuth() {
  const c = useContext(AuthCtx);
  if (!c) throw new Error('usePanelAuth PanelAuthProvider içinde kullanılmalı');
  return c;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = usePanelAuth();
  const loc = useLocation();
  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-panel-bg" aria-busy="true">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cocoa/20 border-t-cocoa" />
      </div>
    );
  }
  if (!user) return <Navigate to={`/panel/giris?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  return <>{children}</>;
}

/** İzin yoksa içerik yerine açıklayıcı mesaj gösterir */
export function RequirePermission({ perm, children }: { perm: Permission; children: ReactNode }) {
  const { can } = usePanelAuth();
  if (!can(perm)) {
    return (
      <div className="rounded-xl border border-panel-line bg-white px-6 py-12 text-center">
        <p className="font-display text-2xl text-espresso">Bu bölüme erişim yetkiniz yok</p>
        <p className="mt-2 text-sm text-panel-muted">Yetki gerektiğini düşünüyorsanız sistem yöneticinize başvurun.</p>
      </div>
    );
  }
  return <>{children}</>;
}
