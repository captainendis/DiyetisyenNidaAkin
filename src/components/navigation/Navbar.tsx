// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Navigasyon: hero üzerinde şeffaf; kaydırınca bulanık koyu yarı saydam zemin + ince alt çizgi.
 * Sitede cam efekti (backdrop-blur) taşıyan tek öğe budur.
 */
import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Logo } from '@/components/icons/Logo';
import { CtaButton } from '@/components/forms/Button';
import { useBooking } from '@/components/forms/BookingProvider';
import { useSite } from '@/data/SiteContext';
import { SocialLinks } from './SocialLinks';
import { cn } from '@/lib/text';

export const NAV_LINKS = [
  { to: '/', label: 'Ana Sayfa', end: true },
  { to: '/hakkimda', label: 'Hakkımda' },
  { to: '/hizmetler', label: 'Hizmetler' },
  { to: '/beslenme-rehberi', label: 'Beslenme Rehberi' },
  { to: '/iletisim', label: 'İletişim' },
];

/** Menü bağlantıları: yayınlanmış tarif varsa "Tarifler" Beslenme Rehberi'nden sonra eklenir */
export function useNavLinks() {
  const { site } = useSite();
  if (!site.recipeCount) return NAV_LINKS;
  const i = NAV_LINKS.findIndex((l) => l.to === '/beslenme-rehberi') + 1;
  return [...NAV_LINKS.slice(0, i), { to: '/tarifler', label: 'Tarifler' }, ...NAV_LINKS.slice(i)];
}

function MenuToggle({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={open ? 'Menüyü kapat' : 'Menüyü aç'} aria-expanded={open} aria-controls="mobile-menu" className="relative z-[61] -mr-2 flex h-11 w-11 items-center justify-center xl:hidden">
      <span className="relative block h-3 w-7">
        <span className={cn('absolute left-0 h-px w-7 bg-cream transition-transform duration-500 ease-[var(--ease-soft)]', open ? 'top-1.5 rotate-45' : 'top-0')} />
        <span className={cn('absolute left-0 h-px bg-cream transition-all duration-500 ease-[var(--ease-soft)]', open ? 'top-1.5 w-7 -rotate-45' : 'top-3 w-4')} />
      </span>
    </button>
  );
}

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const booking = useBooking();
  const reduce = useReducedMotion();
  const { site } = useSite();
  const links = useNavLinks();

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [open]);

  return (
    <>
      <a href="#icerik" className="sr-only z-[100] bg-rose px-4 py-2 text-espresso focus:not-sr-only focus:fixed focus:top-3 focus:left-3">İçeriğe geç</a>
      <header
        className={cn(
          'fixed inset-x-0 top-0 z-[65] transition-[background-color,border-color,backdrop-filter,padding] duration-500 ease-[var(--ease-soft)]',
          scrolled && !open ? 'border-b border-cream/10 bg-espresso/75 backdrop-blur-xl' : 'border-b border-transparent bg-transparent',
        )}
      >
        <div className={cn('container-edge flex items-center justify-between gap-6 transition-[height] duration-500', scrolled ? 'h-[72px]' : 'h-[88px] xl:h-[104px]')}>
          <Link to="/" aria-label="Nida Akın Diyetisyen — Ana sayfa" className="relative z-[61] shrink-0">
            <Logo compact={scrolled} />
          </Link>
          <nav aria-label="Ana menü" className="hidden xl:block">
            <ul className="flex items-center gap-8 xl:gap-12">
              {links.map((l) => (
                <li key={l.to}>
                  <NavLink to={l.to} end={l.end} className={({ isActive }) => cn('group relative py-2 text-[0.92rem] transition-colors', isActive ? 'text-ivory' : 'text-cream/75 hover:text-ivory')}>
                    {({ isActive }) => (
                      <>
                        {l.label}
                        <span className={cn('absolute -bottom-0.5 left-0 h-px w-full origin-left bg-rose transition-transform duration-500 ease-[var(--ease-soft)]', isActive ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-50')} />
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/hesabim" className="hidden py-2 text-[0.88rem] whitespace-nowrap text-cream/80 transition-colors hover:text-ivory xl:block">Danışan girişi</Link>
            <div className="hidden sm:block"><CtaButton onClick={() => booking.open()} className="h-11 px-5 text-[0.88rem] whitespace-nowrap">Randevu Al</CtaButton></div>
            <MenuToggle open={open} onClick={() => setOpen((o) => !o)} />
          </div>
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-menu"
            className="grain fixed inset-0 z-[60] flex flex-col bg-espresso xl:hidden"
            initial={reduce ? { opacity: 0 } : { clipPath: 'inset(0 0 100% 0)' }}
            animate={reduce ? { opacity: 1 } : { clipPath: 'inset(0 0 0% 0)' }}
            exit={reduce ? { opacity: 0 } : { clipPath: 'inset(0 0 100% 0)' }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <nav aria-label="Mobil menü" className="container-edge relative z-[2] flex flex-1 flex-col justify-center pt-24">
              <ul className="space-y-1">
                {links.map((l, i) => (
                  <motion.li key={l.to} initial={{ opacity: 0, y: reduce ? 0 : 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.06, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
                    <NavLink to={l.to} end={l.end} className={({ isActive }) => cn('flex items-baseline gap-5 py-2 font-display text-[2.6rem] leading-tight sm:text-[3.2rem]', isActive ? 'text-rose' : 'text-cream')}>
                      <span className="font-sans text-[0.72rem] tracking-[0.2em] text-mist tabular-nums">0{i + 1}</span>
                      {l.label}
                    </NavLink>
                  </motion.li>
                ))}
              </ul>
            </nav>
            <div className="container-edge relative z-[2] flex flex-col gap-6 border-t border-cream/10 pt-6 pb-[max(2rem,env(safe-area-inset-bottom))]">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
                <CtaButton size="lg" onClick={() => { setOpen(false); booking.open(); }} className="w-full sm:w-auto">Randevu Al</CtaButton>
                <Link to="/hesabim" className="text-center text-[1rem] text-cream underline-offset-4 hover:underline sm:text-left">Danışan girişi</Link>
              </div>
              <SocialLinks social={site.settings.social} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
