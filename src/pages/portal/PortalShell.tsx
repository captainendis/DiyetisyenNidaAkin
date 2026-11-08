// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Danışan hesabı çerçevesi. Telefonda: üst bar + yatay kayan menü şeridi (sayfa yatay kaymaz, yalnızca şerit).
 * Geniş ekranda: solda yapışkan menü. Arama motorlarına kapalı (noindex).
 */
import { useEffect, useRef } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { CalendarDays, FileText, Home, KeyRound, LineChart, ListChecks, LogOut, MessageSquareText, UtensilsCrossed } from 'lucide-react';
import { Logo } from '@/components/icons/Logo';
import { RequirePortalAuth, usePortalAuth } from '@/components/portal/PortalAuth';
import { cn } from '@/lib/text';

const NAV = [
  { to: '/hesabim', label: 'Özet', icon: Home, end: true },
  { to: '/hesabim/listeler', label: 'Listelerim', icon: ListChecks },
  { to: '/hesabim/tarifler', label: 'Tarifler', icon: UtensilsCrossed },
  { to: '/hesabim/randevular', label: 'Randevular', icon: CalendarDays },
  { to: '/hesabim/olcumler', label: 'Ölçümler', icon: LineChart },
  { to: '/hesabim/mesajlar', label: 'Mesajlar', icon: MessageSquareText },
  { to: '/hesabim/dosyalar', label: 'Dosyalar', icon: FileText },
  { to: '/hesabim/hesap', label: 'Hesap', icon: KeyRound },
];

function Layout() {
  const { me, logout } = usePortalAuth();
  const { pathname } = useLocation();
  const strip = useRef<HTMLUListElement>(null);

  // Telefonda etkin menü öğesini şeritte görünür tut
  useEffect(() => {
    strip.current?.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'center' });
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="min-h-dvh bg-ivory text-espresso">
      <meta name="robots" content="noindex, nofollow" />
      <a href="#hesap-icerik" className="sr-only z-[100] bg-rose px-4 py-2 text-espresso focus:not-sr-only focus:fixed focus:top-3 focus:left-3">İçeriğe geç</a>
      <header className="bg-espresso text-cream">
        <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" aria-label="Web sitesine git" className="shrink-0"><Logo compact /></Link>
          <div className="flex min-w-0 items-center gap-2 sm:gap-4">
            <p className="hidden min-w-0 truncate text-[0.88rem] text-cream sm:block">{me?.firstName} {me?.lastName}</p>
            <button type="button" onClick={() => void logout()} className="inline-flex h-10 items-center gap-2 rounded-full px-3 text-[0.88rem] font-medium text-cream ring-1 ring-cream/25 ring-inset hover:bg-cream/10">
              <LogOut className="h-4 w-4" aria-hidden /> Çıkış
            </button>
          </div>
        </div>
        <nav aria-label="Hesap menüsü" className="border-t border-cream/10 lg:hidden">
          <ul ref={strip} className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 py-2 [scrollbar-width:none] sm:px-5">
            {NAV.map((n) => (
              <li key={n.to} className="shrink-0">
                <NavLink
                  to={n.to}
                  end={n.end}
                  className={({ isActive }) => cn('flex h-10 items-center gap-2 rounded-full px-3.5 text-[0.88rem] font-medium whitespace-nowrap transition-colors', isActive ? 'bg-cream text-espresso' : 'text-cream hover:bg-cream/10')}
                >
                  <n.icon className="h-4 w-4" aria-hidden />
                  {n.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <div className="mx-auto grid max-w-6xl gap-10 px-4 pt-8 pb-20 sm:px-6 sm:pt-12 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <nav aria-label="Hesap menüsü" className="hidden lg:block">
          <ul className="sticky top-8 space-y-1">
            {NAV.map((n) => (
              <li key={n.to}>
                <NavLink
                  to={n.to}
                  end={n.end}
                  className={({ isActive }) => cn('flex h-11 items-center gap-3 rounded-xl px-3.5 text-[0.95rem] transition-colors', isActive ? 'bg-espresso font-semibold text-ivory' : 'text-cocoa hover:bg-espresso/[0.06]')}
                >
                  <n.icon className="h-[18px] w-[18px]" aria-hidden />
                  {n.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <main id="hesap-icerik" className="min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default function PortalShell() {
  return (
    <RequirePortalAuth>
      <Layout />
    </RequirePortalAuth>
  );
}
