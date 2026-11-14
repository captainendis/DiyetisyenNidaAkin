// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Danışan hesabı (Hesabım) kimlik bağlamı — panelden bağımsız: ayrı istemci (portalApi), ayrı CSRF token */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Navigate, useLocation, useNavigate } from '@/lib/router';
import { ApiError, portalApi } from '@/lib/api';
import type { PortalMe } from '@shared/portal';

interface Ctx {
  me: PortalMe | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const PortalCtx = createContext<Ctx | null>(null);

export function PortalAuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<PortalMe | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const refresh = useCallback(async () => {
    try {
      const res = await portalApi.get<{ me: PortalMe }>('/auth/me');
      setMe(res.me);
      portalApi.setCsrfToken(res.me.csrfToken);
    } catch (e) {
      if (!(e instanceof ApiError) || e.status === 401) {
        setMe(null);
        portalApi.setCsrfToken(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    portalApi.setUnauthorizedHandler(() => {
      setMe(null);
      portalApi.setCsrfToken(null);
      const p = window.location.pathname;
      if (p.startsWith('/hesabim') && !PUBLIC_PATHS.some((x) => p.startsWith(x))) {
        navigate(`/hesabim/giris?next=${encodeURIComponent(p + window.location.search)}`, { replace: true });
      }
    });
    return () => portalApi.setUnauthorizedHandler(null);
  }, [navigate]);

  const logout = useCallback(async () => {
    await portalApi.post('/auth/logout').catch(() => {});
    setMe(null);
    portalApi.setCsrfToken(null);
    navigate('/hesabim/giris', { replace: true });
  }, [navigate]);

  const value = useMemo<Ctx>(() => ({ me, loading, refresh, logout }), [me, loading, refresh, logout]);
  return <PortalCtx.Provider value={value}>{children}</PortalCtx.Provider>;
}

/** Oturum gerektirmeyen danışan sayfaları */
export const PUBLIC_PATHS = ['/hesabim/giris', '/hesabim/etkinlestir', '/hesabim/sifremi-unuttum', '/hesabim/sifre-sifirla'];

export function usePortalAuth() {
  const c = useContext(PortalCtx);
  if (!c) throw new Error('usePortalAuth PortalAuthProvider içinde kullanılmalı');
  return c;
}

export function RequirePortalAuth({ children }: { children: ReactNode }) {
  const { me, loading } = usePortalAuth();
  const loc = useLocation();
  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-ivory" aria-busy="true">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-espresso/20 border-t-espresso" />
      </div>
    );
  }
  if (!me) return <Navigate to={`/hesabim/giris?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  return <>{children}</>;
}

/** Güvenli yönlendirme: yalnızca /hesabim altındaki iç yollar */
export function safePortalNext(v: string | null) {
  return v && v.startsWith('/hesabim') && !v.startsWith('//') && !PUBLIC_PATHS.some((x) => v.startsWith(x)) ? v : '/hesabim';
}
