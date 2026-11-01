import { useSite } from '@/data/SiteContext';
import { Reveal } from '@/components/motion/Reveal';
import { OliveBranch } from '@/components/icons/Botanical';

/** "Yasaklarla değil, dengeyle." — krem zemin, zeytin dalı çizimi */
export function Approach() {
  const { site } = useSite();
  const a = site.settings.approach;
  const [first, ...rest] = a.heading.split(',');
  return (
    <section className="relative isolate overflow-hidden bg-cream text-espresso" aria-labelledby="approach-title">
      <OliveBranch className="absolute top-10 right-[5%] -z-[5] hidden h-[50%] text-gold/45 lg:block" />
      <div className="container-edge py-24 sm:py-32 lg:py-44">
        <Reveal>
          <h2 id="approach-title" className="max-w-4xl font-display text-[clamp(3rem,1.8rem+5vw,7rem)] leading-[0.95] font-medium tracking-[-0.015em]">
            {first}{rest.length ? ',' : ''}
            {rest.length > 0 && (
              <>
                <br />
                <em className="font-normal text-rose-deep">{rest.join(',').trim()}</em>
              </>
            )}
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="mt-10 max-w-xl text-[1.15rem] leading-[1.75] text-cocoa/85 sm:text-[1.3rem] lg:ml-[28%]">{a.subheading}</p>
        </Reveal>
        <ul className="mt-20 grid gap-y-12 sm:mt-28 md:grid-cols-3">
          {a.pillars.map((p, i) => (
            <Reveal as="li" key={p.title} delay={0.1 + i * 0.1} className={`md:px-10 md:first:pl-0 ${i > 0 ? 'md:border-l md:border-espresso/15' : ''}`}>
              <h3 className="font-display text-[1.9rem] leading-tight font-medium">{p.title}</h3>
              <p className="mt-3 max-w-xs text-[0.98rem] leading-relaxed text-cocoa/75">{p.body}</p>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
