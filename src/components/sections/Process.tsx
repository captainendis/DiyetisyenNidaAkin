import { useSite } from '@/data/SiteContext';
import { Reveal } from '@/components/motion/Reveal';

/** Süreç: masaüstünde yatay zaman çizelgesi, mobilde dikey */
export function Process() {
  const { site } = useSite();
  const p = site.settings.process;
  return (
    <section className="bg-ivory text-espresso" aria-labelledby="process-title">
      <div className="container-edge py-24 sm:py-32 lg:py-40">
        <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
          <Reveal className="lg:col-span-7">
            <h2 id="process-title" className="font-display text-[clamp(2.4rem,1.6rem+2.6vw,4rem)] leading-[1.02] font-medium">{p.heading}</h2>
          </Reveal>
          <Reveal delay={0.1} className="lg:col-span-4 lg:col-start-9">
            <p className="text-[1rem] leading-relaxed text-taupe">{p.intro}</p>
          </Reveal>
        </div>
        <ol className="relative mt-16 grid gap-0 sm:mt-24 lg:grid-cols-4">
          <span className="absolute top-[7px] right-0 left-0 hidden h-px bg-espresso/15 lg:block" aria-hidden />
          <span className="absolute top-2 bottom-2 left-[7px] w-px bg-espresso/15 lg:hidden" aria-hidden />
          {p.steps.map((s, i) => (
            <Reveal as="li" key={s.title} delay={i * 0.12} className="relative pb-12 pl-12 last:pb-0 lg:pr-10 lg:pb-0 lg:pl-0">
              <span className="absolute top-0 left-0 flex h-[15px] w-[15px] items-center justify-center rounded-full border border-gold bg-ivory" aria-hidden>
                <span className="h-[5px] w-[5px] rounded-full bg-gold" />
              </span>
              <p className="font-display text-[3.2rem] leading-none font-light text-gold/80 tabular-nums lg:mt-10 lg:text-[4rem]">{String(i + 1).padStart(2, '0')}</p>
              <h3 className="mt-4 font-display text-[1.75rem] leading-tight font-medium">{s.title}</h3>
              <p className="mt-2 max-w-[17rem] text-[0.95rem] leading-relaxed text-cocoa/75">{s.body}</p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
