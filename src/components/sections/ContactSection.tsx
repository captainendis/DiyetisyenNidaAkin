import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useSite } from '@/data/SiteContext';
import { Reveal } from '@/components/motion/Reveal';
import { useSiteImages } from '@/config/media';
import { formatPhone } from '@/lib/text';
import { Picture } from './Picture';
import { SectionLabel } from './SectionLabel';
import { formatAddress, shortPlace } from './address';

function Row({ label, value, href, external }: { label: string; value: string | null; href?: string | null; external?: boolean }) {
  // Değer girilene kadar satır hiç gösterilmez; "yakında" yazısı siteyi yarım gösteriyordu.
  if (!value) return null;
  let content: ReactNode;
  if (href)
    content = (
      <a href={href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})} className="font-display text-[1.45rem] leading-snug break-words text-espresso underline-offset-4 hover:underline">
        {value}
      </a>
    );
  else content = <span className="font-display text-[1.45rem] leading-snug text-espresso">{value}</span>;
  return (
    <div className="grid grid-cols-[7.5rem_1fr] items-baseline gap-4 border-t border-espresso/12 py-5 sm:grid-cols-[9rem_1fr]">
      <dt className="text-[0.68rem] font-semibold tracking-[0.2em] text-taupe uppercase">{label}</dt>
      <dd className="min-w-0">{content}</dd>
    </div>
  );
}

export function MapBlock({ className = '' }: { className?: string }) {
  const { site } = useSite();
  const c = site.settings.contact;
  if (c.mapEmbedUrl) {
    return (
      <div className={`relative overflow-hidden bg-sand ${className}`}>
        <iframe
          title={`Harita — ${c.venueName ?? 'Nida Akın Diyetisyen'} konumu`}
          src={c.mapEmbedUrl}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="absolute inset-0 h-full w-full border-0 grayscale-[35%] sepia-[18%]"
        />
      </div>
    );
  }
  return (
    <div className={`relative flex items-center justify-center overflow-hidden bg-sand ${className}`} role="img" aria-label="Harita, adres doğrulandıktan sonra eklenecek">
      <svg className="absolute inset-0 h-full w-full text-cocoa/10" aria-hidden>
        <defs>
          <pattern id="streets" width="120" height="120" patternUnits="userSpaceOnUse" patternTransform="rotate(18)">
            <path d="M0 60h120M60 0v120" stroke="currentColor" strokeWidth="1" fill="none" />
            <path d="M0 20h120M20 0v120" stroke="currentColor" strokeWidth=".5" fill="none" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#streets)" />
      </svg>
      <div className="relative flex flex-col items-center px-8 text-center">
        <svg viewBox="0 0 24 32" className="h-10 w-8 text-cocoa/70" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden>
          <path d="M12 31s10-11.2 10-19A10 10 0 0 0 2 12c0 7.8 10 19 10 19Z" />
          <circle cx="12" cy="12" r="3.5" />
        </svg>
        <p className="mt-4 font-display text-[1.35rem] text-espresso">Harita yakında burada</p>
        <p className="mt-1 max-w-[16rem] text-[0.85rem] text-taupe">Adres doğrulandıktan sonra konum ve yol tarifi eklenecek.</p>
      </div>
    </div>
  );
}

/** İletişim bölümü — gerçek mekân fotoğrafı + bilgiler + harita. Boş alanlar gösterilmez. */
export function ContactSection({ heading = true }: { heading?: boolean }) {
  const images = useSiteImages();
  const { site } = useSite();
  const c = site.settings.contact;
  const s = site.settings.social;
  const address = formatAddress(c);
  const place = shortPlace(c);
  const igHandle = s.instagram ? '@' + s.instagram.replace(/\/$/, '').split('/').pop() : null;
  return (
    <section className="bg-ivory text-espresso" aria-labelledby={heading ? 'contact-title' : undefined}>
      <div className="container-edge grid gap-14 py-24 sm:py-32 lg:grid-cols-12 lg:gap-x-10 lg:py-40">
        <Reveal className="lg:col-span-4">
          <div className="relative lg:sticky lg:top-28">
            <Picture {...images.venue} sizes="(min-width: 1024px) 30vw, 90vw" className="block" imgClassName="aspect-[4/5] h-auto w-full object-cover" />
            <p className="mt-4 text-[0.8rem] leading-relaxed text-taupe">
              {c.venueName ? <>{c.venueName}{place ? ` — ${place.split(',')[0]}` : ''}</> : 'Sıcak ışıklı, sakin bir mekânda — kendinize ayırdığınız zaman için.'}
            </p>
          </div>
        </Reveal>
        <div className="lg:col-span-7 lg:col-start-6">
          {heading && (
            <Reveal>
              <SectionLabel>İletişim</SectionLabel>
              <h2 id="contact-title" className="mt-8 font-display text-[clamp(2.4rem,1.6rem+2.6vw,4rem)] leading-[1.02] font-medium">
                Görüşme yeri ve iletişim
              </h2>
            </Reveal>
          )}
          {c.venueName && (
            <Reveal delay={0.05}>
              <div className={heading ? 'mt-12' : ''}>
                <p className="text-[0.68rem] font-semibold tracking-[0.2em] text-taupe uppercase">Görüşme yeri</p>
                <p className="mt-3 font-display text-[2rem] leading-tight text-espresso sm:text-[2.3rem]">{c.venueName}</p>
                {c.venueNote && <p className="mt-2 max-w-lg text-[0.95rem] leading-relaxed text-taupe">{c.venueNote}</p>}
              </div>
            </Reveal>
          )}
          <Reveal delay={0.1}>
            <dl className="mt-10 border-b border-espresso/12">
              <Row label="Telefon" value={c.phone ? formatPhone(c.phone) : null} href={c.phone ? `tel:${c.phone}` : null} />
              <Row label="WhatsApp" value={c.whatsapp ? 'Mesaj gönderin' : null} href={c.whatsapp ? `https://wa.me/${c.whatsapp}` : null} external />
              <Row label="Instagram" value={igHandle} href={s.instagram} external />
              <Row label="E-posta" value={c.email} href={c.email ? `mailto:${c.email}` : null} />
              <Row label="Adres" value={address} />
              {c.hoursNote && <Row label="Çalışma saatleri" value={c.hoursNote} />}
            </dl>
          </Reveal>
          <Reveal delay={0.15}>
            <MapBlock className="mt-10 aspect-[16/9] w-full" />
            {c.mapLinkUrl && (
              <a href={c.mapLinkUrl} target="_blank" rel="noopener noreferrer" className="group mt-6 inline-flex items-center gap-2.5 border-b border-espresso pb-1 text-[0.95rem] font-medium text-espresso">
                Yol tarifi al
                <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">→</span>
              </a>
            )}
            <p className="mt-5 text-[0.9rem] text-taupe">
              Randevu talebinizi doğrudan{' '}
              <Link to="/randevu" className="text-espresso underline decoration-gold underline-offset-4">çevrim içi form</Link> ile de iletebilirsiniz.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
