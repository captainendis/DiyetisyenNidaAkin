import { useSite } from '@/data/SiteContext';
import { PageHeader } from '@/components/sections/PageHeader';
import { PortraitPlaceholder } from '@/components/sections/PortraitPlaceholder';
import { SectionLabel } from '@/components/sections/SectionLabel';
import { Approach } from '@/components/sections/Approach';
import { Process } from '@/components/sections/Process';
import { CtaBand } from '@/components/sections/CtaBand';
import { Reveal } from '@/components/motion/Reveal';
import { Seo, useBusinessJsonLd } from '@/components/seo/Seo';
import { Sprig } from '@/components/icons/Botanical';

export default function AboutPage() {
  const { site } = useSite();
  const about = site.settings.about;
  const business = useBusinessJsonLd();
  const crumbs = [{ name: 'Hakkımda', path: '/hakkimda' }];
  return (
    <>
      <Seo title="Hakkımda" description={about.lead.slice(0, 160)} breadcrumbs={crumbs} jsonLd={business} />
      <PageHeader title="Hakkımda" crumbs={crumbs} lead={about.lead} />

      <section className="bg-ivory text-espresso">
        <div className="container-edge grid gap-14 py-24 sm:py-32 lg:grid-cols-12 lg:gap-x-10 lg:py-40">
          <Reveal className="lg:col-span-5">
            <div className="lg:sticky lg:top-28">
              <PortraitPlaceholder />
              <p className="mt-4 text-[0.8rem] text-taupe">{site.settings.business.brandName} · {site.settings.business.title}</p>
            </div>
          </Reveal>
          <div className="lg:col-span-6 lg:col-start-7">
            <Reveal>
              <SectionLabel>{about.eyebrow}</SectionLabel>
              <h2 className="mt-8 font-display text-[clamp(2.1rem,1.4rem+2.2vw,3.5rem)] leading-[1.08] font-medium">{about.heading}</h2>
            </Reveal>
            <div className="mt-10 space-y-6">
              {about.paragraphs.map((p, i) => (
                <Reveal key={i} delay={i * 0.05}>
                  <p className="text-[1.08rem] leading-[1.9] text-cocoa/85">{p}</p>
                </Reveal>
              ))}
            </div>
            <Reveal>
              <div className="mt-14 border-t border-espresso/12 pt-10">
                <p className="text-[0.7rem] font-semibold tracking-[0.22em] text-taupe uppercase">Danışanlarıma yaklaşımım</p>
                <ul className="mt-8 space-y-8">
                  {about.pillars.map((p) => (
                    <li key={p.title}>
                      <p className="font-display text-[1.6rem] leading-tight">{p.title}</p>
                      <p className="mt-2 text-[0.98rem] leading-relaxed text-taupe">{p.body}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
            {about.credentials.length > 0 && (
              <Reveal>
                <div className="mt-14 border-t border-espresso/12 pt-10">
                  <p className="text-[0.7rem] font-semibold tracking-[0.22em] text-taupe uppercase">Eğitim ve mesleki bilgiler</p>
                  <dl className="mt-6 divide-y divide-espresso/10">
                    {about.credentials.map((c) => (
                      <div key={c.label + c.value} className="grid gap-1 py-4 sm:grid-cols-[12rem_1fr] sm:gap-6">
                        <dt className="text-[0.85rem] text-taupe">{c.label}</dt>
                        <dd className="text-[1rem] text-espresso">{c.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </Reveal>
            )}
            <Reveal>
              <div className="mt-16 flex items-center gap-5">
                <Sprig className="w-16 text-gold" />
                <p className="font-display text-[2.6rem] leading-none italic text-cocoa/80" aria-label={`İmza: ${about.signature}`}>{about.signature}</p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>
      <Approach />
      <Process />
      <CtaBand />
    </>
  );
}
