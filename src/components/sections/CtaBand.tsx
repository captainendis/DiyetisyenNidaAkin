import { useSite } from '@/data/SiteContext';
import { useBooking } from '@/components/forms/BookingProvider';
import { CtaButton } from '@/components/forms/Button';
import { Reveal } from '@/components/motion/Reveal';
import { LeafPair } from '@/components/icons/Botanical';

/** Randevu çağrısı — koyu dokulu zemin, köşelerde ince yaprak çizimleri */
export function CtaBand() {
  const { site } = useSite();
  const cta = site.settings.cta;
  const booking = useBooking();
  const words = cta.heading.split(' ');
  const cut = Math.ceil(words.length / 2);
  return (
    <section className="grain relative isolate overflow-hidden bg-cocoa text-cream" aria-labelledby="cta-title">
      <LeafPair className="absolute -top-8 -left-10 -z-[1] w-[260px] text-gold/35 sm:w-[360px]" />
      <LeafPair className="absolute -right-12 -bottom-10 -z-[1] w-[280px] rotate-180 text-gold/30 sm:w-[400px]" />
      <div className="container-edge relative z-[2] flex flex-col items-center py-28 text-center sm:py-36 lg:py-44">
        <Reveal>
          <h2 id="cta-title" className="max-w-4xl font-display text-[clamp(2.5rem,1.4rem+4.2vw,5.6rem)] leading-[1] font-medium tracking-[-0.01em] text-ivory">
            {words.slice(0, cut).join(' ')}{' '}
            <em className="font-normal text-rose">{words.slice(cut).join(' ')}</em>
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="mt-8 max-w-md text-[1.08rem] leading-relaxed text-cream/75">{cta.body}</p>
        </Reveal>
        <Reveal delay={0.2}>
          <CtaButton size="lg" className="mt-12" onClick={() => booking.open()}>{cta.button}</CtaButton>
        </Reveal>
      </div>
    </section>
  );
}
