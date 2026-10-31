import { Link } from 'react-router';
import { useSite } from '@/data/SiteContext';
import { Reveal } from '@/components/motion/Reveal';
import { ServiceIcon } from '@/components/icons/ServiceIcon';
import { TextLink } from '@/components/forms/Button';
import { SectionLabel } from './SectionLabel';

/**
 * Hizmetler — kart ızgarası yerine editoryal liste: numara, ikon, büyük başlık, hover'da açılan özet.
 * Sol sütun yapışkan başlık; sağda ince çizgilerle ayrılmış satırlar.
 */
export function ServicesSection() {
  const { site } = useSite();
  return (
    <section className="grain relative bg-espresso text-cream" aria-labelledby="services-title">
      <div className="container-edge relative z-[2] grid gap-14 py-24 sm:py-32 lg:grid-cols-12 lg:gap-x-10 lg:py-40">
        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-32">
            <Reveal>
              <SectionLabel index="03" tone="light">Hizmetler</SectionLabel>
              <h2 id="services-title" className="mt-8 font-display text-[clamp(2.4rem,1.6rem+2.6vw,4rem)] leading-[1.02] font-medium">
                Size özel,<br /><em className="font-normal text-rose">adım adım.</em>
              </h2>
              <p className="mt-6 max-w-sm text-[1rem] leading-relaxed text-mist">
                Her danışmanlık süreci, ihtiyacınıza göre şekillenir. Size en uygun başlığı ilk görüşmede birlikte belirleriz.
              </p>
              <TextLink to="/hizmetler" className="mt-8">Tüm hizmetler</TextLink>
            </Reveal>
          </div>
        </div>
        <ol className="lg:col-span-8">
          {site.services.map((s, i) => (
            <Reveal as="li" key={s.id} delay={Math.min(i * 0.05, 0.2)} amount={0.4}>
              <Link
                to={`/hizmetler/${s.slug}`}
                className="group grid grid-cols-[auto_1fr_auto] items-start gap-x-5 border-t border-cream/12 py-8 transition-colors duration-500 last:border-b hover:bg-cream/[0.025] sm:gap-x-8 sm:py-10"
              >
                <span className="pt-2 font-display text-[1rem] text-gold italic tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-5">
                    <ServiceIcon name={s.icon} className="hidden h-11 w-11 shrink-0 text-mist transition-colors duration-500 group-hover:text-rose sm:block" />
                    <h3 className="font-display text-[1.65rem] leading-[1.1] font-medium transition-colors group-hover:text-ivory sm:text-[2.1rem]">{s.title}</h3>
                  </div>
                  <p className="mt-3 max-w-xl text-[0.95rem] leading-relaxed text-mist sm:pl-16 lg:max-h-0 lg:overflow-hidden lg:opacity-0 lg:transition-all lg:duration-700 lg:ease-[var(--ease-soft)] lg:group-hover:max-h-32 lg:group-hover:opacity-100 lg:group-focus-visible:max-h-32 lg:group-focus-visible:opacity-100">
                    {s.summary}
                  </p>
                </div>
                <span className="mt-3 flex h-10 w-10 items-center justify-center rounded-full border border-cream/20 text-cream/60 transition-all duration-500 group-hover:border-rose group-hover:bg-rose group-hover:text-espresso" aria-hidden>
                  <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 -rotate-45 transition-transform duration-500 group-hover:rotate-0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 8h10M9 4l4 4-4 4" /></svg>
                </span>
              </Link>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
