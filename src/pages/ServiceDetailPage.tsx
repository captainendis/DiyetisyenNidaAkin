// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import { Link, useParams } from 'react-router';
import { useSite } from '@/data/SiteContext';
import { PageHeader } from '@/components/sections/PageHeader';
import { CtaBand } from '@/components/sections/CtaBand';
import { Process } from '@/components/sections/Process';
import { Reveal } from '@/components/motion/Reveal';
import { ServiceIcon } from '@/components/icons/ServiceIcon';
import { CtaButton } from '@/components/forms/Button';
import { useBooking } from '@/components/forms/BookingProvider';
import { Seo, SITE_URL } from '@/components/seo/Seo';
import { ServiceMeta } from './ServicesPage';
import NotFoundPage from './NotFoundPage';

export default function ServiceDetailPage() {
  const { slug } = useParams();
  const { site, ready } = useSite();
  const booking = useBooking();
  const service = site.services.find((s) => s.slug === slug);
  if (!service) return ready ? <NotFoundPage /> : <div className="min-h-dvh bg-espresso" />;
  const crumbs = [{ name: 'Hizmetler', path: '/hizmetler' }, { name: service.title, path: `/hizmetler/${service.slug}` }];
  const others = site.services.filter((s) => s.id !== service.id);
  return (
    <>
      <Seo
        title={service.title}
        description={service.summary}
        breadcrumbs={crumbs}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'Service',
          name: service.title,
          description: service.summary,
          url: `${SITE_URL}/hizmetler/${service.slug}`,
          provider: { '@type': 'ProfessionalService', name: 'Nida Akın — Diyetisyen', url: `${SITE_URL}/` },
        }}
      />
      <PageHeader title={service.title} crumbs={crumbs} lead={service.summary} />
      <section className="bg-ivory text-espresso">
        <div className="container-edge grid gap-14 py-20 sm:py-28 lg:grid-cols-12 lg:gap-x-10 lg:py-36">
          <Reveal className="lg:col-span-3">
            <ServiceIcon name={service.icon} className="h-20 w-20 text-gold-ink" />
            <div className="mt-6"><ServiceMeta durationMinutes={service.durationMinutes} priceCents={service.priceCents} /></div>
          </Reveal>
          <Reveal className="lg:col-span-7 lg:col-start-5">
            <p className="text-[1.15rem] leading-[1.9] text-cocoa/85">{service.description}</p>
            <div className="mt-12 flex flex-wrap items-center gap-6 border-t border-espresso/12 pt-10">
              <CtaButton tone="dark" size="lg" onClick={() => booking.open({ serviceId: service.id })}>Randevu Al</CtaButton>
              <p className="max-w-xs text-[0.85rem] text-taupe">Talebiniz onay bekler; uygunluk kontrolünden sonra sizinle iletişime geçilir.</p>
            </div>
          </Reveal>
        </div>
      </section>
      <Process />
      {others.length > 0 && (
        <section className="bg-cream text-espresso">
          <div className="container-edge py-20 sm:py-28">
            <p className="text-[0.7rem] font-semibold tracking-[0.22em] text-taupe uppercase">Diğer hizmetler</p>
            <ul className="mt-8 grid gap-px overflow-hidden border border-espresso/10 bg-espresso/10 sm:grid-cols-2 lg:grid-cols-3">
              {others.map((s) => (
                <li key={s.id}>
                  <Link to={`/hizmetler/${s.slug}`} className="group flex h-full items-center gap-5 bg-cream px-6 py-7 transition-colors hover:bg-ivory">
                    <ServiceIcon name={s.icon} className="h-10 w-10 shrink-0 text-gold-ink transition-colors group-hover:text-rose-ink" />
                    <span className="font-display text-[1.35rem] leading-tight">{s.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
      <CtaBand />
    </>
  );
}
