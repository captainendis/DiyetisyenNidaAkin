import { Link } from 'react-router';
import { Logo } from '@/components/icons/Logo';
import { PaperAxisMark } from '@/components/icons/PaperAxisMark';
import { DEVELOPER } from '@shared/credits';
import { SocialLinks } from '@/components/navigation/SocialLinks';
import { NAV_LINKS } from '@/components/navigation/Navbar';
import { useSite } from '@/data/SiteContext';
import { formatPhone } from '@/lib/text';
import { formatAddress } from '@/components/sections/address';

const LEGAL = [
  { to: '/kvkk-aydinlatma-metni', label: 'KVKK Aydınlatma Metni' },
  { to: '/acik-riza-metni', label: 'Açık Rıza Metni' },
  { to: '/gizlilik-politikasi', label: 'Gizlilik Politikası' },
  { to: '/cerez-politikasi', label: 'Çerez Politikası' },
];

export function Footer() {
  const { site } = useSite();
  const { contact, social, business, approach } = site.settings;
  const address = formatAddress(contact);
  const contactItems = [
    contact.phone && { label: 'Telefon', value: formatPhone(contact.phone), href: `tel:${contact.phone}` },
    contact.email && { label: 'E-posta', value: contact.email, href: `mailto:${contact.email}` },
    address && { label: contact.venueName ?? 'Adres', value: address, href: contact.mapLinkUrl ?? undefined },
  ].filter(Boolean) as { label: string; value: string; href?: string }[];

  return (
    <footer className="relative overflow-hidden border-t border-cream/10 bg-espresso text-cream">
      <div className="container-edge pt-20 pb-10 lg:pt-28">
        <div className="grid gap-14 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <Logo />
            <p className="mt-10 max-w-md font-display text-[2rem] leading-[1.1] text-cream/90 sm:text-[2.5rem]">
              {approach.heading}
            </p>
          </div>
          <nav aria-label="Alt menü" className="lg:col-span-3">
            <ul className="space-y-3">
              {NAV_LINKS.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="text-[0.95rem] text-cream/70 transition-colors hover:text-rose">{l.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="space-y-5 lg:col-span-3">
            {contactItems.map((c) => (
              <div key={c.label}>
                <p className="text-[0.68rem] font-semibold tracking-[0.2em] text-mist uppercase">{c.label}</p>
                {c.href ? (
                  <a href={c.href} className="mt-1 block text-[0.95rem] text-cream/85 hover:text-rose">{c.value}</a>
                ) : (
                  <p className="mt-1 text-[0.95rem] text-cream/85">{c.value}</p>
                )}
              </div>
            ))}
            {contact.hoursNote && <p className="text-[0.9rem] text-mist">{contact.hoursNote}</p>}
            {!contactItems.length && (
              <p className="max-w-xs text-[0.9rem] leading-relaxed text-mist">
                İletişim bilgileri yakında eklenecek. Şimdilik{' '}
                <Link to="/randevu" className="text-cream underline decoration-gold underline-offset-4">randevu formu</Link> üzerinden ulaşabilirsiniz.
              </p>
            )}
            <SocialLinks social={social} className="-ml-2.5" />
          </div>
        </div>
        <div className="mt-20 flex flex-col gap-5 border-t border-cream/10 pt-8 text-[0.8rem] text-mist lg:flex-row lg:items-center lg:justify-between">
          <p>© {new Date().getFullYear()} {business.brandName} · {business.title}</p>
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {LEGAL.map((l) => (
              <li key={l.to}><Link to={l.to} className="hover:text-cream">{l.label}</Link></li>
            ))}
          </ul>
        </div>
        <a
          href={DEVELOPER.url}
          target="_blank"
          rel="noopener"
          className="mt-6 inline-flex items-center gap-2 text-[0.72rem] text-mist/80 transition-colors hover:text-cream"
        >
          <PaperAxisMark className="h-3 w-3" />
          {DEVELOPER.credit}
        </a>
      </div>
    </footer>
  );
}
