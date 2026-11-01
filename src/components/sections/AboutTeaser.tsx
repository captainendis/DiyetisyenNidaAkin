// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import { useSite } from '@/data/SiteContext';
import { Reveal } from '@/components/motion/Reveal';
import { TextLink } from '@/components/forms/Button';
import { PortraitPlaceholder } from './PortraitPlaceholder';
import { SectionLabel } from './SectionLabel';

export function AboutTeaser() {
  const { site } = useSite();
  const about = site.settings.about;
  return (
    <section className="relative bg-cream text-espresso">
      <div className="container-edge grid items-center gap-14 py-24 sm:py-32 lg:grid-cols-12 lg:gap-x-10 lg:py-40">
        <Reveal className="relative lg:col-span-5">
          <PortraitPlaceholder className="mx-auto w-full max-w-[460px] lg:max-w-none" />
        </Reveal>
        <div className="lg:col-span-6 lg:col-start-7">
          <Reveal>
            <SectionLabel>{about.eyebrow}</SectionLabel>
            <h2 className="mt-8 font-display text-[clamp(2.1rem,1.4rem+2.2vw,3.5rem)] leading-[1.08] font-medium">{about.heading}</h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-8 text-[1.08rem] leading-[1.85] text-cocoa/85">{about.lead}</p>
          </Reveal>
          <Reveal delay={0.15}>
            <ul className="mt-10 grid gap-6 border-t border-espresso/12 pt-8 sm:grid-cols-3">
              {about.pillars.map((p) => (
                <li key={p.title}>
                  <p className="font-display text-[1.3rem] leading-tight">{p.title}</p>
                  <p className="mt-2 text-[0.88rem] leading-relaxed text-taupe">{p.body}</p>
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={0.2} className="mt-12">
            <TextLink to="/hakkimda" tone="dark">Hakkımda daha fazlası</TextLink>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
