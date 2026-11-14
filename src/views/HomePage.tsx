// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

'use client';

import { Hero } from '@/components/sections/Hero';
import { Intro } from '@/components/sections/Intro';
import { AboutTeaser } from '@/components/sections/AboutTeaser';
import { ServicesSection } from '@/components/sections/ServicesSection';
import { Approach } from '@/components/sections/Approach';
import { Process } from '@/components/sections/Process';
import { RecentRecipes } from '@/components/sections/RecentRecipes';
import { CtaBand } from '@/components/sections/CtaBand';
import { ContactSection } from '@/components/sections/ContactSection';
import { Seo, useBusinessJsonLd, SITE_URL } from '@/components/seo/Seo';

export default function HomePage() {
  const business = useBusinessJsonLd();
  return (
    <>
      <Seo
        jsonLd={[
          business,
          { '@context': 'https://schema.org', '@type': 'WebSite', name: 'Nida Akın Diyetisyen', url: `${SITE_URL}/`, inLanguage: 'tr-TR' },
        ]}
      />
      <Hero />
      <Intro />
      <AboutTeaser />
      <ServicesSection />
      <Approach />
      <Process />
      <RecentRecipes />
      <CtaBand />
      <ContactSection />
    </>
  );
}
