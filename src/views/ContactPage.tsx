// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

'use client';

import { useSite } from '@/data/SiteContext';
import { PageHeader } from '@/components/sections/PageHeader';
import { ContactSection } from '@/components/sections/ContactSection';
import { CtaBand } from '@/components/sections/CtaBand';
import { Seo, useBusinessJsonLd } from '@/components/seo/Seo';

export default function ContactPage() {
  const { site } = useSite();
  const business = useBusinessJsonLd();
  const crumbs = [{ name: 'İletişim', path: '/iletisim' }];
  return (
    <>
      <Seo
        title="İletişim"
        description="Diyetisyen Nida Akın ile iletişime geçin ya da çevrim içi randevu talebi oluşturun."
        breadcrumbs={crumbs}
        jsonLd={{ '@context': 'https://schema.org', '@type': 'ContactPage', name: 'İletişim', about: business }}
      />
      <PageHeader
        title="İletişim"
        crumbs={crumbs}
        lead={site.settings.contact.hoursNote ?? "Görüşmeler Pelin Tek Studio Bahçekent'in üst katında yapılır. Telefon, WhatsApp ya da randevu formundan ulaşabilirsiniz."}
      />
      <ContactSection heading={false} />
      <CtaBand />
    </>
  );
}
