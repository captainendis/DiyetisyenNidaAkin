// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Toast bildirimleri ve onay diyaloğu (Promise tabanlı) */
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { BodyPortal } from '@/components/BodyPortal';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';
import { cn } from '@/lib/format';

type ToastTone = 'success' | 'error' | 'info' | 'warning';
interface Toast { id: number; tone: ToastTone; title: string; description?: string }

interface ConfirmOptions {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
}

interface FeedbackCtx {
  toast: (t: Omit<Toast, 'id'>) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  confirm: (o: ConfirmOptions) => Promise<boolean>;
}

const Ctx = createContext<FeedbackCtx | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dialog, setDialog] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => setToasts((ts) => ts.filter((t) => t.id !== id)), []);
  const toast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = ++idRef.current;
    setToasts((ts) => [...ts.slice(-3), { ...t, id }]);
    setTimeout(() => dismiss(id), t.tone === 'error' ? 7000 : 4500);
  }, [dismiss]);

  const value = useMemo<FeedbackCtx>(() => ({
    toast,
    success: (title, description) => toast({ tone: 'success', title, description }),
    error: (title, description) => toast({ tone: 'error', title, description }),
    confirm: (o) => new Promise<boolean>((resolve) => setDialog({ ...o, resolve })),
  }), [toast]);

  const close = (v: boolean) => {
    dialog?.resolve(v);
    setDialog(null);
  };

  const icons = { success: CheckCircle2, error: XCircle, info: Info, warning: AlertTriangle };
  const tones = { success: 'text-success', error: 'text-danger', info: 'text-info', warning: 'text-warning' };

  return (
    <Ctx.Provider value={value}>
      {children}
      <BodyPortal>
        <div className="panel-root pointer-events-none fixed inset-x-0 bottom-0 z-[90] flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6" aria-live="polite" role="status">
          {toasts.map((t) => {
            const Icon = icons[t.tone];
            return (
              <div key={t.id} className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl bg-espresso px-4 py-3 text-ivory shadow-[0_18px_40px_-12px_rgba(33,23,16,0.5)] animate-fade-in">
                <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', tones[t.tone])} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{t.title}</p>
                  {t.description && <p className="mt-0.5 text-[0.8rem] text-mist">{t.description}</p>}
                </div>
                <button type="button" onClick={() => dismiss(t.id)} aria-label="Kapat" className="rounded p-0.5 text-mist hover:text-ivory">
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      </BodyPortal>
      <Modal
        open={!!dialog}
        onClose={() => close(false)}
        title={dialog?.title ?? ''}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => close(false)}>{dialog?.cancelLabel ?? 'Vazgeç'}</Button>
            <Button variant={dialog?.tone === 'danger' ? 'danger' : 'primary'} onClick={() => close(true)} data-autofocus>
              {dialog?.confirmLabel ?? 'Onayla'}
            </Button>
          </>
        }
      >
        <div className="text-sm leading-relaxed text-cocoa/80">{dialog?.description}</div>
      </Modal>
    </Ctx.Provider>
  );
}

export function useFeedback() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useFeedback FeedbackProvider içinde kullanılmalı');
  return c;
}
