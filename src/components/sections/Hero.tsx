import { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { useSite } from '@/data/SiteContext';
import { useBooking } from '@/components/forms/BookingProvider';
import { CtaButton, TextLink } from '@/components/forms/Button';
import { FadeIn, StaggerLines } from '@/components/motion/Reveal';
import { AppleOutline } from '@/components/icons/Botanical';
import { useSiteImages } from '@/config/media';
import { Picture } from './Picture';
import { shortPlace } from './address';

export function Hero() {
  const { site } = useSite();
  const hero = site.settings.hero;
  const { contact } = site.settings;
  const booking = useBooking();
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const images = useSiteImages();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const imgY = useTransform(scrollYProgress, [0, 1], ['0%', reduce ? '0%' : '12%']);
  const textY = useTransform(scrollYProgress, [0, 1], ['0%', reduce ? '0%' : '-10%']);

  return (
    <section ref={ref} className="grain relative isolate flex min-h-[100svh] flex-col overflow-hidden bg-espresso" aria-label="Giriş">
      {/* Mekân fotoğrafı — masaüstünde sağ ~%58, mobilde tam arka plan */}
      <motion.div style={{ y: imgY }} className="absolute inset-x-0 top-0 -z-10 h-[64svh] lg:inset-y-0 lg:right-0 lg:left-auto lg:h-auto lg:w-[min(max(54vw,calc(100svh*0.83)),calc(100svh*0.98))]">
        <Picture
          {...images.hero}
          sizes="(min-width: 1024px) 60vw, 100vw"
          priority
          className="block h-full w-full"
          imgClassName="h-full w-full object-cover object-[50%_20%] lg:object-[50%_30%]"
        />
        {/* Sol geçiş: fotoğraf koyu duvara erir */}
        <div className="absolute inset-0 bg-gradient-to-r from-espresso/50 via-transparent to-transparent lg:from-espresso lg:via-espresso/0 lg:via-35%" aria-hidden />
        <div className="absolute inset-0 bg-gradient-to-t from-espresso from-25% via-espresso/45 to-espresso/0 lg:from-espresso/70 lg:from-0% lg:via-transparent lg:via-30% lg:to-espresso/80" aria-hidden />
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-espresso/90 to-transparent" aria-hidden />
        {contact.venueName && (
          <p className="absolute right-6 bottom-8 z-[1] hidden text-right text-[0.68rem] tracking-[0.2em] text-cream/75 uppercase lg:block xl:right-10">
            {contact.venueName}{shortPlace(contact) ? <span className="text-cream/60"> — {contact.district ?? contact.city}</span> : null}
          </p>
        )}
        <div className="absolute inset-0 lg:shadow-[inset_0_0_180px_60px_rgba(33,23,16,0.75)]" aria-hidden />
      </motion.div>

      {/* Çok hafif botanik çizgi: logo ile akraba elma konturu, sağ kenardan taşar */}
      <AppleOutline className="pointer-events-none absolute top-[22%] -right-[9vw] -z-[5] hidden w-[30vw] max-w-[440px] text-rose/25 lg:block" />

      <motion.div style={{ y: textY }} className="container-edge relative z-[2] flex flex-1 flex-col justify-end pt-32 pb-10 sm:pb-14 lg:justify-center lg:pt-40 lg:pb-40">
        <div className="max-w-[640px]">
          <FadeIn delay={0.1}>
            <p className="eyebrow eyebrow-line text-cream/85">{hero.eyebrow}</p>
          </FadeIn>
          <h1 className="mt-7 font-display font-medium tracking-[-0.01em] text-ivory sm:mt-9">
            <StaggerLines
              delay={0.25}
              lines={[hero.titleLine1, hero.titleLine2]}
              className="block text-[clamp(3.6rem,2.2rem+6vw,7.6rem)] leading-[0.92]"
              lineClassName={(i) => (i === 1 ? 'text-rose' : '')}
            />
          </h1>
          <FadeIn delay={0.7}>
            <p className="mt-7 max-w-[30rem] text-[1.05rem] leading-[1.7] text-cream/85 sm:text-[1.15rem]">{hero.description}</p>
          </FadeIn>
          <FadeIn delay={0.85} className="mt-9 flex flex-wrap items-center gap-x-8 gap-y-4">
            <CtaButton size="lg" onClick={() => booking.open()}>{hero.primaryCta}</CtaButton>
            <TextLink to="/hakkimda">{hero.secondaryCta}</TextLink>
          </FadeIn>
        </div>

        <FadeIn delay={1.05} className="mt-14 lg:absolute lg:bottom-14 lg:mt-0">
          <ul className="grid max-w-[580px] grid-cols-3 border-t border-cream/15 pt-6 lg:border-0 lg:pt-0">
            {hero.features.map((f, i) => (
              <li key={f} className={`px-3 text-[0.78rem] leading-snug text-cream/80 first:pl-0 sm:px-6 sm:text-[0.88rem] ${i > 0 ? 'border-l border-cream/15' : ''}`}>
                {f}
              </li>
            ))}
          </ul>
        </FadeIn>
      </motion.div>

      {/* Kaydırma göstergesi: tek seferlik giriş, döngü yok */}
      <a href="#tanisin" className="group absolute left-1/2 bottom-10 z-[2] hidden -translate-x-1/2 flex-col items-center gap-3 text-cream/60 transition-colors hover:text-cream xl:flex" aria-label="Aşağı kaydır">
        <span className="text-[0.62rem] tracking-[0.32em] uppercase">Keşfet</span>
        <motion.span
          className="block h-12 w-px origin-top bg-cream/50"
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ delay: 1.6, duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        />
      </a>
    </section>
  );
}
