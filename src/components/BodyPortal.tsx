// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

'use client';

/**
 * İçeriği document.body'ye taşır. Sunucuda (SSR) ve ilk hidrasyonda hiçbir şey çizmez; tarayıcıda bağlandıktan
 * sonra portal açılır (createPortal(…, document.body) sunucuda çalışamaz).
 */
import { useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const subscribe = () => () => {};

export function BodyPortal({ children }: { children: ReactNode }) {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  return mounted ? createPortal(children, document.body) : null;
}
