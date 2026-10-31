import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { FadeIn, StaggerLines } from '@/components/motion/Reveal';
import { OliveBranch } from '@/components/icons/Botanical';
import type { Crumb } from '@/components/seo/Seo';

/** Alt sayfa başlığı — koyu, dokulu zemin; şeffaf navigasyonun altında başlar */
export function PageHeader({
  title, accent, lead, crumbs, aside, eyebrow,
}: { title: string; accent?: string; lead?: ReactNode; crumbs?: Crumb[]; aside?: ReactNode; eyebrow?: string }) {
  return (
    <header className="grain relative isolate overflow-hidden bg-espresso text-cream">
      <OliveBranch className="absolute top-20 right-[6%] -z-[1] h-[120%] rotate-[18deg] text-gold/15" />
      <div className="container-edge relative z-[2] grid gap-10 pt-40 pb-16 sm:pt-48 sm:pb-24 lg:grid-cols-12 lg:items-end">
        <div className="lg:col-span-8">
          {crumbs && (
            <FadeIn>
              <nav aria-label="Sayfa yolu">
                <ol className="flex flex-wrap items-center gap-2 text-[0.75rem] tracking-[0.08em] text-mist">
                  <li><Link to="/" className="hover:text-cream">Ana Sayfa</Link></li>
                  {crumbs.map((c, i) => (
                    <li key={c.path} className="flex items-center gap-2">
                      <span aria-hidden className="text-mist/50">/</span>
                      {i === crumbs.length - 1 ? <span aria-current="page" className="text-cream/80">{c.name}</span> : <Link to={c.path} className="hover:text-cream">{c.name}</Link>}
                    </li>
                  ))}
                </ol>
              </nav>
            </FadeIn>
          )}
          {eyebrow && <FadeIn delay={0.05}><p className="eyebrow eyebrow-line mt-8 text-rose">{eyebrow}</p></FadeIn>}
          <h1 className="mt-6 font-display text-[clamp(2.9rem,1.6rem+4.6vw,6.4rem)] leading-[0.98] font-medium tracking-[-0.01em] text-ivory">
            <StaggerLines lines={accent ? [title, <em key="a" className="font-normal text-rose">{accent}</em>] : [title]} delay={0.1} />
          </h1>
          {lead && (
            <FadeIn delay={0.4}>
              <div className="mt-8 max-w-2xl text-[1.05rem] leading-[1.75] text-cream/75 sm:text-[1.15rem]">{lead}</div>
            </FadeIn>
          )}
        </div>
        {aside && <FadeIn delay={0.5} className="lg:col-span-4">{aside}</FadeIn>}
      </div>
    </header>
  );
}
