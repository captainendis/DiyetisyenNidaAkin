// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

'use client';

import { useEffect } from 'react';
import { Outlet, useLocation } from '@/lib/router';
import { motion, useReducedMotion } from 'motion/react';
import { Navbar } from '@/components/navigation/Navbar';
import { Footer } from './Footer';
import { BookingProvider } from '@/components/forms/BookingProvider';

function ScrollManager() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const el = document.getElementById(decodeURIComponent(hash.slice(1)));
      if (el) {
        setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
        return;
      }
    }
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname, hash]);
  return null;
}

export function PublicLayout() {
  const { pathname } = useLocation();
  const reduce = useReducedMotion();
  return (
    <BookingProvider>
      <ScrollManager />
      <Navbar />
      <motion.main
        id="icerik"
        key={pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: reduce ? 0 : 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <Outlet />
      </motion.main>
      <Footer />
    </BookingProvider>
  );
}
