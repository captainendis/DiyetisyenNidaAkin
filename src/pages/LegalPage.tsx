// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import { useSite } from '@/data/SiteContext';
import { PageHeader } from '@/components/sections/PageHeader';
import { Seo } from '@/components/seo/Seo';
import { buildLegal, type LegalDoc } from '@/components/sections/legal/content';
import { KVKK_NOTICE_VERSION } from '@shared/constants';

const PATHS: Record<LegalDoc, string> = {
  kvkk: '/kvkk-aydinlatma-metni',
  consent: '/acik-riza-metni',
  privacy: '/gizlilik-politikasi',
  cookies: '/cerez-politikasi',
};

export default function LegalPage({ doc }: { doc: LegalDoc }) {
  const { site } = useSite();
  const c = buildLegal(doc, site.settings);
  const crumbs = [{ name: `${c.title} ${c.accent ?? ''}`.trim(), path: PATHS[doc] }];
  return (
    <>
      <Seo title={crumbs[0].name} description={c.description} breadcrumbs={crumbs} />
      <PageHeader title={c.accent ? `${c.title} ${c.accent}` : c.title} crumbs={crumbs} />
      <section className="bg-ivory text-espresso">
        <div className="container-edge grid gap-12 py-16 sm:py-24 lg:grid-cols-12 lg:gap-x-10">
          <aside className="lg:col-span-3">
            <div className="border-l-2 border-warning bg-warning/10 px-5 py-4 text-[0.88rem] leading-relaxed text-[#6d4c1e] lg:sticky lg:top-28" role="note">
              <strong className="block font-semibold">Taslak metin</strong>
              Bu metin taslaktır; yayın öncesi hukuk uzmanınca gözden geçirilmelidir.
              <span className="mt-2 block text-[0.78rem]">Sürüm: {KVKK_NOTICE_VERSION}</span>
            </div>
          </aside>
          <div className="prose-editorial lg:col-span-7 lg:col-start-5">
            <p className="!mt-0 font-display text-[1.45rem] leading-snug text-cocoa">{c.intro}</p>
            {c.sections.map((s) => (
              <section key={s.heading}>
                <h2>{s.heading}</h2>
                {s.list && (
                  <ul>
                    {s.list.map((l, i) => <li key={i}>{l}</li>)}
                  </ul>
                )}
                {s.paragraphs?.map((p, i) => <p key={i}>{p}</p>)}
              </section>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
