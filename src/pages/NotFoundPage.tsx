// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import { useEffect } from 'react';
import { CtaLink, TextLink } from '@/components/forms/Button';
import { AppleOutline } from '@/components/icons/Botanical';
import { Seo } from '@/components/seo/Seo';

export default function NotFoundPage() {
  useEffect(() => {
    document.documentElement.dataset.status = '404';
    return () => {
      delete document.documentElement.dataset.status;
    };
  }, []);
  return (
    <section className="grain relative isolate flex min-h-[100svh] items-center overflow-hidden bg-espresso text-cream">
      <Seo title="Sayfa bulunamadı" noindex />
      <AppleOutline className="absolute top-1/2 right-[-10vw] -z-[1] w-[60vw] max-w-[720px] -translate-y-1/2 text-rose/15" />
      <div className="container-edge relative z-[2] py-40">
        <p className="eyebrow eyebrow-line text-mist">Hata 404</p>
        <h1 className="mt-8 font-display text-[clamp(3rem,2rem+5vw,7rem)] leading-[0.95] font-medium text-ivory">
          Bu sayfa bulunamadı.
        </h1>
        <p className="mt-8 max-w-md text-[1.05rem] leading-relaxed text-cream/70">Bağlantı değişmiş ya da sayfa kaldırılmış olabilir. Ana sayfadan devam edebilirsiniz.</p>
        <div className="mt-10 flex flex-wrap items-center gap-8">
          <CtaLink to="/">Ana sayfaya dön</CtaLink>
          <TextLink to="/beslenme-rehberi">Beslenme Rehberi</TextLink>
        </div>
      </div>
    </section>
  );
}
