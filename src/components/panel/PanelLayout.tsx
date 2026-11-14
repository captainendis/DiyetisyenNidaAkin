// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import { useEffect, useRef, useState, type ComponentType } from 'react';
import { Link, NavLink, Outlet, useLocation } from '@/lib/router';
import {
  BarChart3, Bell, CalendarDays, ClipboardList, CalendarCog, CookingPot, Dumbbell, ExternalLink, FileText, LayoutDashboard, Leaf, LogOut, Menu, Settings, UserRound, Users, X,
} from 'lucide-react';
import { LogoMark } from '@/components/icons/Logo';
import { FeedbackProvider } from './ui';
import { usePanelAuth, type Permission } from './PanelAuth';
import { cn } from '@/lib/format';
import { DateTime } from 'luxon';
import { TIME_ZONE } from '@shared/constants';

interface NavItem { to: string; label: string; icon: ComponentType<{ className?: string }>; perm?: Permission; end?: boolean; badge?: 'notifications' }

const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: 'Günlük',
    items: [
      { to: '/panel', label: 'Genel Bakış', icon: LayoutDashboard, end: true, perm: 'dashboard:read' },
      { to: '/panel/randevular', label: 'Randevular', icon: CalendarDays, perm: 'appointments:read' },
      { to: '/panel/danisanlar', label: 'Danışanlar', icon: Users, perm: 'clients:read' },
      { to: '/panel/pilates', label: 'Pilates', icon: Dumbbell, perm: 'appointments:read' },
      { to: '/panel/planlar', label: 'Beslenme Planları', icon: ClipboardList, perm: 'clinical:read' },
      { to: '/panel/tarifler', label: 'Tarifler', icon: CookingPot, perm: 'clinical:read' },
      { to: '/panel/bildirimler', label: 'Bildirimler', icon: Bell, badge: 'notifications' },
    ],
  },
  {
    group: 'İşletme',
    items: [
      { to: '/panel/raporlar', label: 'Raporlar', icon: BarChart3, perm: 'reports:read' },
      { to: '/panel/hizmetler', label: 'Hizmetler', icon: Leaf, perm: 'services:write' },
      { to: '/panel/icerikler', label: 'Web Sitesi İçeriği', icon: FileText, perm: 'content:write' },
    ],
  },
  {
    group: 'Ayarlar',
    items: [
      { to: '/panel/ayarlar/takvim', label: 'Çalışma Takvimi', icon: CalendarCog, perm: 'availability:write' },
      { to: '/panel/ayarlar', label: 'Ayarlar', icon: Settings, end: true },
    ],
  },
];

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { can, unreadCount, logout, user } = usePanelAuth();
  return (
    <div className="flex h-full flex-col bg-espresso text-cream">
      <Link to="/panel" onClick={onNavigate} className="flex items-center gap-3 px-6 pt-6 pb-8">
        <LogoMark className="h-9 w-9 text-rose" strokeWidth={1.6} />
        <span className="leading-none">
          <span className="block font-display text-[1.35rem] font-medium">Nida Akın</span>
          <span className="mt-1 block text-[0.58rem] font-semibold tracking-[0.32em] text-mist uppercase">Yönetim Paneli</span>
        </span>
      </Link>
      <nav className="flex-1 space-y-6 overflow-y-auto px-3" aria-label="Panel menüsü">
        {NAV.map((g) => {
          const items = g.items.filter((i) => !i.perm || can(i.perm));
          if (!items.length) return null;
          return (
            <div key={g.group}>
              <p className="px-3 pb-2 text-[0.65rem] font-semibold tracking-[0.18em] text-mist uppercase">{g.group}</p>
              <ul className="space-y-0.5">
                {items.map((i) => (
                  <li key={i.to}>
                    <NavLink
                      to={i.to}
                      end={i.end}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        cn(
                          'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[0.88rem] font-medium transition-colors',
                          isActive ? 'bg-cream/[0.09] text-ivory' : 'text-cream/70 hover:bg-cream/[0.05] hover:text-ivory',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <i.icon className={cn('h-[18px] w-[18px] shrink-0', isActive ? 'text-rose' : 'text-mist group-hover:text-cream')} />
                          <span className="flex-1">{i.label}</span>
                          {i.badge === 'notifications' && unreadCount > 0 && (
                            <span className="tabular min-w-5 rounded-full bg-rose px-1.5 text-center text-[0.7rem] font-bold text-espresso">
                              {unreadCount > 99 ? '99+' : unreadCount}
                            </span>
                          )}
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>
      <div className="border-t border-cream/10 p-3">
        <a href="/" target="_blank" rel="noopener" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[0.85rem] text-cream/70 hover:bg-cream/[0.05] hover:text-ivory">
          <ExternalLink className="h-4 w-4 text-mist" /> Web sitesini görüntüle
        </a>
        <button type="button" onClick={() => void logout()} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[0.85rem] text-cream/70 hover:bg-cream/[0.05] hover:text-ivory">
          <LogOut className="h-4 w-4 text-mist" /> Oturumu kapat
        </button>
        {user && <p className="truncate px-3 pt-2 text-[0.72rem] text-mist">{user.email}</p>}
      </div>
    </div>
  );
}

function UserMenu() {
  const { user, logout } = usePanelAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const on = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', on);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('mousedown', on);
      document.removeEventListener('keydown', key);
    };
  }, [open]);
  if (!user) return null;
  const name = `${user.firstName} ${user.lastName}`;
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} className="flex items-center gap-2.5 rounded-lg py-1 pr-2 pl-1 hover:bg-cocoa/[0.05]">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-cocoa text-[0.75rem] font-bold text-rose">
          {user.firstName[0]}{user.lastName[0]}
        </span>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block text-[0.82rem] font-semibold text-espresso">{name}</span>
          <span className="block text-[0.7rem] text-panel-muted">{user.role === 'ASSISTANT' ? 'Asistan' : user.role === 'ADMIN' ? 'Yönetici' : 'Diyetisyen'}</span>
        </span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-xl border border-panel-line bg-white py-1.5 shadow-[0_18px_40px_-16px_rgba(33,23,16,0.35)]">
          <Link role="menuitem" to="/panel/ayarlar" onClick={() => setOpen(false)} className="flex items-center gap-2.5 px-4 py-2 text-sm text-cocoa hover:bg-panel-bg">
            <UserRound className="h-4 w-4" /> Profil ve hesap
          </Link>
          <button role="menuitem" type="button" onClick={() => void logout()} className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-cocoa hover:bg-panel-bg">
            <LogOut className="h-4 w-4" /> Oturumu kapat
          </button>
        </div>
      )}
    </div>
  );
}

export function PanelLayout() {
  const [drawer, setDrawer] = useState(false);
  const { unreadCount, demoMode } = usePanelAuth();
  const loc = useLocation();
  useEffect(() => setDrawer(false), [loc.pathname]);
  const today = DateTime.now().setZone(TIME_ZONE).toFormat('d MMMM yyyy, cccc');

  useEffect(() => {
    const prev = document.querySelector('meta[name="robots"]');
    const m = prev ?? Object.assign(document.createElement('meta'), { name: 'robots' });
    m.setAttribute('content', 'noindex, nofollow');
    if (!prev) document.head.appendChild(m);
  }, []);

  return (
    <FeedbackProvider>
      <div className="panel-root min-h-dvh bg-panel-bg font-sans text-espresso">
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
          <Sidebar />
        </aside>
        {drawer && (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menü">
            <div className="absolute inset-0 bg-espresso/50 animate-fade-in" onClick={() => setDrawer(false)} />
            <div className="absolute inset-y-0 left-0 w-[82%] max-w-72 animate-fade-in shadow-2xl">
              <button type="button" onClick={() => setDrawer(false)} aria-label="Menüyü kapat" className="absolute top-5 right-3 z-10 rounded-lg p-2 text-cream/80 hover:bg-cream/10">
                <X className="h-5 w-5" />
              </button>
              <Sidebar onNavigate={() => setDrawer(false)} />
            </div>
          </div>
        )}
        <div className="lg:pl-64">
          <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-panel-line bg-panel-bg/90 px-4 backdrop-blur-md sm:px-6 lg:px-10">
            <button type="button" onClick={() => setDrawer(true)} aria-label="Menüyü aç" className="-ml-1 rounded-lg p-2 text-cocoa hover:bg-cocoa/[0.06] lg:hidden">
              <Menu className="h-5 w-5" />
            </button>
            <p className="hidden text-sm text-panel-muted capitalize sm:block">{today}</p>
            <div className="ml-auto flex items-center gap-1.5">
              <Link to="/panel/bildirimler" aria-label={`Bildirimler${unreadCount ? ` (${unreadCount} okunmamış)` : ''}`} className="relative rounded-lg p-2 text-cocoa hover:bg-cocoa/[0.06]">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="tabular absolute top-1 right-1 min-w-4 rounded-full bg-danger px-1 text-center text-[0.62rem] leading-4 font-bold text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
              <UserMenu />
            </div>
          </header>
          {demoMode && (
            <div className="border-b border-warning/30 bg-warning/15 px-4 py-2 text-center text-[0.8rem] font-medium text-[#7d5720] sm:px-6">
              Demo modu açık — gösterilen danışan ve randevu kayıtları örnek verilerdir.
            </div>
          )}
          <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
            <Outlet />
          </main>
        </div>
      </div>
    </FeedbackProvider>
  );
}
