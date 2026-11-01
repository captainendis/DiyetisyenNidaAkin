import { useSite } from '@/data/SiteContext';
import { Reveal } from '@/components/motion/Reveal';
import { SectionLabel } from './SectionLabel';
import { LogoMark } from '@/components/icons/Logo';

/** Marka tanıtımı — açık krem zemin, büyük tipografi, asimetrik yerleşim */
export function Intro() {
  const { site } = useSite();
  const intro = site.settings.intro;
  return (
    <section id="tanisin" className="relative overflow-hidden bg-ivory text-espresso">
      <div className="container-edge grid gap-y-14 py-24 sm:py-32 lg:grid-cols-12 lg:gap-x-10 lg:py-44">
        <Reveal className="lg:col-span-12">
          <SectionLabel>Yaklaşım</SectionLabel>
        </Reveal>
        <Reveal className="lg:col-span-9 lg:col-start-1">
          <h2 className="font-display text-[clamp(2.4rem,1.4rem+3.6vw,5rem)] leading-[1.04] font-medium tracking-[-0.01em]">
            {intro.heading}
          </h2>
        </Reveal>

        <div className="grid gap-12 lg:col-span-12 lg:grid-cols-12 lg:gap-x-10">
          <Reveal delay={0.1} className="hidden lg:col-span-3 lg:col-start-2 lg:block">
            <div className="flex h-full flex-col justify-between border-l border-gold/40 pl-6">
              <LogoMark className="h-14 w-14 text-rose-deep/80" strokeWidth={1.1} />
              <p className="mt-16 text-[0.7rem] leading-relaxed font-semibold tracking-[0.22em] text-taupe uppercase">
                Kişiye özel<br />beslenme danışmanlığı
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.2} className="lg:col-span-6 lg:col-start-6 lg:pt-2">
            <p className="text-[1.1rem] leading-[1.85] text-cocoa/85 sm:text-[1.2rem]">
              <span className="float-left mt-[0.08em] mr-3 font-display text-[4.6rem] leading-[0.8] text-rose-deep">{intro.body.charAt(0)}</span>
              {intro.body.slice(1)}
            </p>
            <div className="mt-12 border-t border-espresso/12 pt-8">
              <p className="font-display text-[1.7rem] leading-snug italic text-espresso sm:text-[2rem]">“{intro.aside}”</p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
