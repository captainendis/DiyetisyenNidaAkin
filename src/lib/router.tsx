// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

'use client';

/**
 * Yönlendirme yardımcıları — Next.js App Router (next/navigation) üzerinde, uygulamanın daha önce kullandığı
 * React Router API'siyle aynı biçim: Link, NavLink, Navigate, Outlet, useNavigate, useParams, useLocation,
 * useSearchParams, useBlocker. Sayfa bileşenleri bu modülden içe aktarır; yönlendirme kütüphanesi değişirse
 * yalnızca bu dosya değişir.
 */
import NextLink from 'next/link';
import { useParams as useNextParams, usePathname, useRouter, useSearchParams as useNextSearchParams } from 'next/navigation';
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type AnchorHTMLAttributes,
  type ReactNode,
} from 'react';

type To = string;

// ───────────────────────── Link / NavLink ─────────────────────────

export interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  to: To;
  replace?: boolean;
  children?: ReactNode;
}

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link({ to, replace, ...rest }, ref) {
  return <NextLink ref={ref} href={to} replace={replace} {...rest} />;
});

interface NavState {
  isActive: boolean;
  isPending: boolean;
}

export interface NavLinkProps extends Omit<LinkProps, 'className' | 'children' | 'style'> {
  end?: boolean;
  className?: string | ((s: NavState) => string | undefined);
  style?: React.CSSProperties | ((s: NavState) => React.CSSProperties | undefined);
  children?: ReactNode | ((s: NavState) => ReactNode);
}

export const NavLink = forwardRef<HTMLAnchorElement, NavLinkProps>(function NavLink({ to, end, className, style, children, ...rest }, ref) {
  const pathname = usePathname() ?? '/';
  const target = to.split(/[?#]/)[0]!.replace(/\/$/, '') || '/';
  const isActive = end || target === '/' ? pathname === target : pathname === target || pathname.startsWith(`${target}/`);
  const s: NavState = { isActive, isPending: false };
  return (
    <NextLink
      ref={ref}
      href={to}
      aria-current={isActive ? 'page' : undefined}
      className={typeof className === 'function' ? className(s) : className}
      style={typeof style === 'function' ? style(s) : style}
      {...rest}
    >
      {typeof children === 'function' ? children(s) : children}
    </NextLink>
  );
});

// ───────────────────────── Gezinme ─────────────────────────

export function useNavigate() {
  const router = useRouter();
  return useCallback(
    (to: To | number, opts?: { replace?: boolean }) => {
      if (typeof to === 'number') {
        if (to < 0) router.back();
        else router.forward();
        return;
      }
      if (opts?.replace) router.replace(to);
      else router.push(to);
    },
    [router],
  );
}

/** Çizildiğinde yönlendirir */
export function Navigate({ to, replace }: { to: To; replace?: boolean }) {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(to, { replace });
  }, [navigate, to, replace]);
  return null;
}

// ───────────────────────── Konum ve parametreler ─────────────────────────

export function useParams<T extends Record<string, string | undefined> = Record<string, string | undefined>>(): T {
  const p = useNextParams() ?? {};
  return useMemo(() => {
    const out: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(p)) out[k] = Array.isArray(v) ? v.join('/') : decodeURIComponent(v as string);
    return out as T;
  }, [p]);
}

function useHash() {
  const [hash, setHash] = useState('');
  const pathname = usePathname();
  useEffect(() => {
    const read = () => setHash(window.location.hash);
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, [pathname]);
  return hash;
}

export function useLocation() {
  const pathname = usePathname() ?? '/';
  const sp = useNextSearchParams();
  const hash = useHash();
  const search = sp?.toString() ? `?${sp.toString()}` : '';
  return useMemo(() => ({ pathname, search, hash, state: null as unknown, key: `${pathname}${search}` }), [pathname, search, hash]);
}

type SetSearchParams = (
  next: URLSearchParams | Record<string, string> | ((prev: URLSearchParams) => URLSearchParams | Record<string, string>),
  opts?: { replace?: boolean },
) => void;

export function useSearchParams(): [URLSearchParams, SetSearchParams] {
  const sp = useNextSearchParams();
  const router = useRouter();
  const pathname = usePathname() ?? '/';
  const current = useMemo(() => new URLSearchParams(sp?.toString() ?? ''), [sp]);
  const set = useCallback<SetSearchParams>(
    (next, opts) => {
      const value = typeof next === 'function' ? next(new URLSearchParams(current)) : next;
      const params = value instanceof URLSearchParams ? value : new URLSearchParams(value);
      const qs = params.toString();
      const url = `${pathname}${qs ? `?${qs}` : ''}`;
      // React Router'daki gibi sayfa en üste kaydırılmaz (filtre/sekme değişimleri)
      if (opts?.replace) router.replace(url, { scroll: false });
      else router.push(url, { scroll: false });
    },
    [current, pathname, router],
  );
  return [current, set];
}

// ───────────────────────── Outlet ─────────────────────────

const OutletCtx = createContext<ReactNode>(null);

/** Next.js layout'unun `children`'ını, içinde <Outlet /> kullanan kabuk bileşenlerine iletir */
export function OutletProvider({ children, outlet }: { children: ReactNode; outlet: ReactNode }) {
  return <OutletCtx.Provider value={outlet}>{children}</OutletCtx.Provider>;
}

export function Outlet() {
  return <>{useContext(OutletCtx)}</>;
}

// ───────────────────────── Ayrılma uyarısı ─────────────────────────

interface Blocker {
  state: 'unblocked' | 'blocked';
  proceed: () => void;
  reset: () => void;
}

/**
 * Kaydedilmemiş değişiklik varken site içi bağlantı tıklamalarını durdurur ve onay ister; sekme kapatma/yenilemede
 * tarayıcının kendi uyarısını gösterir. (Next.js'te gezinmeyi engelleyen bir API olmadığından tarayıcının geri
 * düğmesi kapsanmaz.)
 */
export function useBlocker(shouldBlock: (args: { currentLocation: { pathname: string }; nextLocation: { pathname: string } }) => boolean): Blocker {
  const router = useRouter();
  const pathname = usePathname() ?? '/';
  const [pending, setPending] = useState<string | null>(null);
  const fn = useRef(shouldBlock);
  fn.current = shouldBlock;

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (!fn.current({ currentLocation: { pathname }, nextLocation: { pathname: url.pathname } })) return;
      e.preventDefault();
      e.stopPropagation();
      setPending(url.pathname + url.search + url.hash);
    };
    const onUnload = (e: BeforeUnloadEvent) => {
      if (fn.current({ currentLocation: { pathname }, nextLocation: { pathname: '' } })) e.preventDefault();
    };
    document.addEventListener('click', onClick, true);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [pathname]);

  return {
    state: pending ? 'blocked' : 'unblocked',
    proceed: () => {
      const to = pending;
      setPending(null);
      if (to) router.push(to);
    },
    reset: () => setPending(null),
  };
}
