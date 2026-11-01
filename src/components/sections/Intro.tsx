// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import { useSite } from '@/data/SiteContext';
import { Reveal } from '@/components/motion/Reveal';

/** Marka tanıtımı — açık krem zemin, büyük tipografi, asimetrik yerleşim */
export function Intro() {
  const { site } = useSite();
  const intro = site.settings.intro;
  return (
    <section id="tanisin" className="relative overflow-hidden bg-ivory text-espresso">
      <div className="container-edge grid gap-y-14 py-24 sm:py-32 lg:grid-cols-12 lg:gap-x-10 lg:py-44">
        <Reveal className="lg:col-span-9 lg:col-start-1">
          <h2 className="font-display text-[clamp(2.4rem,1.4rem+3.6vw,5rem)] leading-[1.04] font-medium tracking-[-0.01em]">
            {intro.heading}
          </h2>
        </Reveal>

        <Reveal delay={0.1} className="lg:col-span-6 lg:col-start-6">
          <p className="text-[1.1rem] leading-[1.85] text-cocoa/85 sm:text-[1.2rem]">{intro.body}</p>
          {intro.aside && (
            <p className="mt-12 border-t border-espresso/12 pt-8 font-display text-[1.7rem] leading-snug text-espresso sm:text-[2rem]">
              {intro.aside}
            </p>
          )}
        </Reveal>
      </div>
    </section>
  );
}
