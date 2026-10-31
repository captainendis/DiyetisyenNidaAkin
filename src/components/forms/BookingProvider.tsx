/**
 * Global randevu modalı. Sitedeki tüm "Randevu Al" düğmeleri useBooking().open() çağırır.
 * Masaüstü: sol koyu bilgi şeridi + sağ form. Mobil: tam yükseklikte alt sayfa.
 */
import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { X } from 'lucide-react';
import { useLocation } from 'react-router';
import { StepIndicator } from './StepIndicator';

// Form (zod doğrulama + luxon takvim) yalnızca randevu penceresi açıldığında yüklenir
const BookingForm = lazy(() => import('./BookingForm').then((m) => ({ default: m.BookingForm })));
import { LogoMark } from '@/components/icons/Logo';
import { useSite } from '@/data/SiteContext';

interface Ctx {
  open: (opts?: { serviceId?: string | null }) => void;
  close: () => void;
}
const BookingCtx = createContext<Ctx>({ open: () => {}, close: () => {} });

export function useBooking() {
  return useContext(BookingCtx);
}

function BookingDialog({ serviceId, onClose }: { serviceId: string | null; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { site } = useSite();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  useEffect(() => {
    const last = document.activeElement as HTMLElement | null;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    setTimeout(() => ref.current?.querySelector<HTMLElement>('button, input')?.focus(), 60);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && ref.current) {
        const els = Array.from(ref.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]):not([tabindex="-1"]), textarea'));
        if (!els.length) return;
        const first = els[0], lastEl = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastEl.focus(); }
        else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
      last?.focus?.();
    };
  }, [onClose]);

  return (
    <motion.div className="fixed inset-0 z-[70] flex items-end justify-center lg:items-center lg:p-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
      <div className="absolute inset-0 bg-[#120c08]/80" onClick={onClose} aria-hidden />
      <motion.div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-title"
        initial={reduce ? { opacity: 0 } : { y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={reduce ? { opacity: 0 } : { y: 30, opacity: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative flex h-[100dvh] w-full max-w-6xl overflow-hidden bg-ivory lg:h-[min(820px,92dvh)] lg:shadow-[0_40px_120px_-30px_rgba(0,0,0,0.7)] lg:ring-1 lg:ring-cream/10"
      >
        <aside className="grain relative hidden w-[34%] shrink-0 flex-col justify-between overflow-hidden bg-cocoa p-10 text-cream lg:flex">
          <img src="/images/mekan-masa-585.webp" alt="" className="absolute inset-0 h-full w-full object-cover opacity-55" loading="lazy" width={585} height={696} />
          <div className="absolute inset-0 bg-gradient-to-b from-cocoa/70 via-cocoa/30 to-cocoa/95" aria-hidden />
          <div className="relative z-[2]">
            <LogoMark className="h-10 w-10 text-rose" />
            <p id="booking-title" className="mt-8 font-display text-[2.6rem] leading-[1.02] font-medium">Randevu<br /><em className="font-normal text-rose">talebi</em></p>
          </div>
          <div className="relative z-[2] space-y-6">
            <StepIndicator step={step === 4 ? 4 : step} tone="dark" vertical />
            <p className="max-w-xs text-[0.85rem] leading-relaxed text-mist">{site.settings.appointment.formNote}</p>
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-espresso/10 px-5 py-4 sm:px-8 lg:border-0 lg:px-12 lg:pt-8 lg:pb-0">
            <div className="lg:hidden"><StepIndicator step={step === 4 ? 4 : step} /></div>
            <span className="hidden lg:block" />
            <button type="button" onClick={onClose} aria-label="Kapat" className="-mr-2 rounded-full p-2 text-taupe transition-colors hover:bg-espresso/5 hover:text-espresso">
              <X className="h-5 w-5" strokeWidth={1.5} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 pt-6 pb-10 sm:px-8 lg:px-12 lg:pt-4">
            <Suspense fallback={<div className="flex h-40 items-center justify-center" aria-busy="true"><span className="h-6 w-6 animate-spin rounded-full border-2 border-espresso/15 border-t-espresso" /></div>}>
              <BookingForm initialServiceId={serviceId} onStepChange={setStep} />
            </Suspense>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function BookingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ open: boolean; serviceId: string | null }>({ open: false, serviceId: null });
  const open = useCallback((opts?: { serviceId?: string | null }) => setState({ open: true, serviceId: opts?.serviceId ?? null }), []);
  const close = useCallback(() => setState((s) => ({ ...s, open: false })), []);
  const { pathname } = useLocation();
  useEffect(() => close(), [pathname, close]);
  return (
    <BookingCtx.Provider value={{ open, close }}>
      {children}
      {createPortal(<AnimatePresence>{state.open && <BookingDialog key="booking" serviceId={state.serviceId} onClose={close} />}</AnimatePresence>, document.body)}
    </BookingCtx.Provider>
  );
}
