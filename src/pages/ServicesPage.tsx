// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import { Link } from 'react-router';
import { useSite } from '@/data/SiteContext';
import { PageHeader } from '@/components/sections/PageHeader';
import { CtaBand } from '@/components/sections/CtaBand';
import { Reveal } from '@/components/motion/Reveal';
import { ServiceIcon } from '@/components/icons/ServiceIcon';
import { useBooking } from '@/components/forms/BookingProvider';
import { Seo, SITE_URL } from '@/components/seo/Seo';
import { formatMoney } from '@/lib/text';

export function ServiceMeta({ durationMinutes, priceCents }: { durationMinutes: number | null; priceCents: number | null }) {
  if (!durationMinutes && priceCents == null) return null;
  return (
    <p className="text-[0.8rem] tracking-[0.06em] text-taupe">
      {durationMinutes ? `${durationMinutes} dakika` : ''}
      {durationMinutes && priceCents != null ? ' · ' : ''}
      {priceCents != null ? formatMoney(priceCents) : ''}
    </p>
  );
}

export default function ServicesPage() {
  const { site } = useSite();
  const booking = useBooking();
  const crumbs = [{ name: 'Hizmetler', path: '/hizmetler' }];
  return (
    <>
      <Seo
        title="Hizmetler"
        description="Kişiye özel beslenme danışmanlığı, kilo yönetimi, sağlıklı yaşam beslenmesi ve beslenme takibi. Size uygun hizmeti birlikte belirleyelim."
        breadcrumbs={crumbs}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          itemListElement: site.services.map((s, i) => ({ '@type': 'ListItem', position: i + 1, name: s.title, url: `${SITE_URL}/hizmetler/${s.slug}` })),
        }}
      />
      <PageHeader
        title="Hizmetler"
        crumbs={crumbs}
        lead="Aşağıdaki başlıklar bir başlangıç noktası. Hangisinin size uyduğuna ilk görüşmede birlikte karar veriyoruz."
      />
      <section className="bg-ivory text-espresso">
        <div className="container-edge py-20 sm:py-28 lg:py-36">
          <ul>
            {site.services.map((s) => (
              <Reveal as="li" key={s.id} amount={0.3}>
                <article id={s.slug} className="grid scroll-mt-28 gap-6 border-t border-espresso/12 py-12 last:border-b sm:py-16 lg:grid-cols-12 lg:gap-x-10">
                  <div className="lg:col-span-6">
                    <ServiceIcon name={s.icon} className="h-12 w-12 text-gold" />
                    <h2 className="mt-6 font-display text-[clamp(2rem,1.5rem+1.6vw,3rem)] leading-[1.05] font-medium">
                      <Link to={`/hizmetler/${s.slug}`} className="hover:text-cocoa">{s.title}</Link>
                    </h2>
                    <div className="mt-3"><ServiceMeta durationMinutes={s.durationMinutes} priceCents={s.priceCents} /></div>
                  </div>
                  <div className="lg:col-span-5 lg:col-start-8">
                    <p className="font-display text-[1.35rem] leading-snug text-cocoa">{s.summary}</p>
                    <p className="mt-5 text-[1rem] leading-[1.85] text-cocoa/75">{s.description}</p>
                    <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-3">
                      <button type="button" onClick={() => booking.open({ serviceId: s.id })} className="group inline-flex items-center gap-2 border-b border-espresso pb-1 text-[0.95rem] font-medium">
                        Bu hizmet için randevu al
                        <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
                      </button>
                      <Link to={`/hizmetler/${s.slug}`} className="text-[0.9rem] text-taupe hover:text-espresso">Ayrıntılar</Link>
                    </div>
                  </div>
                </article>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>
      <CtaBand />
    </>
  );
}
