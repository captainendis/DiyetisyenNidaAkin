// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from '@/lib/router';
import { api } from '@/lib/api';
import { useSite } from '@/data/SiteContext';
import type { PostCard as Post } from '@/data/types';
import { FilterNav } from '@/components/sections/FilterNav';
import { PageHeader } from '@/components/sections/PageHeader';
import { PostCard } from '@/components/cards/PostCard';
import { FaqList } from '@/components/sections/FaqList';
import { Reveal } from '@/components/motion/Reveal';
import { Seo, SITE_URL } from '@/components/seo/Seo';
import { Sprig } from '@/components/icons/Botanical';
import { cn } from '@/lib/text';

const FAQ_SLUG = 'sik-sorulan-sorular';

export default function BlogListPage() {
  const { category } = useParams();
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('sayfa') ?? 1));
  const { site } = useSite();
  const [data, setData] = useState<{ posts: Post[]; total: number; pageSize: number } | null>(null);
  const [error, setError] = useState(false);
  const cat = site.categories.find((c) => c.slug === category);

  useEffect(() => {
    let alive = true;
    setError(false);
    api
      .get<{ posts: Post[]; total: number; pageSize: number }>('/public/blog', { category, page })
      .then((r) => alive && setData(r))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [category, page]);

  const crumbs = [{ name: 'Beslenme Rehberi', path: '/beslenme-rehberi' }, ...(cat ? [{ name: cat.name, path: `/beslenme-rehberi/kategori/${cat.slug}` }] : [])];
  const posts = data?.posts ?? [];
  const pages = data ? Math.ceil(data.total / data.pageSize) : 1;
  const showFaq = !category || category === FAQ_SLUG;
  const [first, ...rest] = posts;

  return (
    <>
      <Seo
        title={cat ? `${cat.name} — Beslenme Rehberi` : 'Beslenme Rehberi'}
        description="Sağlıklı beslenme, günlük alışkanlıklar ve besinler üzerine genel bilgilendirme yazıları. İçerikler tıbbi tavsiye yerine geçmez."
        breadcrumbs={crumbs}
        jsonLd={{ '@context': 'https://schema.org', '@type': 'Blog', name: 'Beslenme Rehberi', url: `${SITE_URL}/beslenme-rehberi`, inLanguage: 'tr-TR' }}
      />
      <PageHeader
        title="Beslenme rehberi"
        crumbs={crumbs}
        lead="Günlük hayata dair sade, uygulanabilir yazılar. Buradaki içerikler genel bilgilendirme amaçlıdır; kişiye özel değerlendirme için bir uzmana danışın."
      />
      <section className="bg-ivory text-espresso">
        <div className="container-edge py-14 sm:py-20">
          {/* Hiç yayınlanmış yazı yokken boş kategori sekmeleri gösterilmez. */}
          {!(data && data.total === 0 && !category) && (
            <FilterNav
              label="Kategori"
              items={[{ slug: undefined as string | undefined, name: 'Tümü' }, ...site.categories].map((c) => ({
                key: c.slug ?? 'all',
                label: c.name,
                to: c.slug ? `/beslenme-rehberi/kategori/${c.slug}` : '/beslenme-rehberi',
                active: c.slug === category,
              }))}
            />
          )}

          <div className="pt-14 sm:pt-20">
            {error ? (
              <p className="py-16 text-center text-taupe">Yazılar şu an yüklenemedi. Lütfen daha sonra tekrar deneyin.</p>
            ) : !data ? (
              <div className="grid gap-10 md:grid-cols-3" aria-busy="true" aria-label="Yükleniyor">
                {[0, 1, 2].map((i) => <div key={i} className="aspect-[3/2] animate-pulse bg-sand/70" />)}
              </div>
            ) : posts.length === 0 ? (
              category === FAQ_SLUG ? null : (
                <div className="mx-auto flex max-w-lg flex-col items-center py-16 text-center">
                  <Sprig className="w-24 text-gold" />
                  <p className="mt-8 font-display text-[2.2rem] leading-tight">Yazılar hazırlanıyor.</p>
                  <p className="mt-3 text-[1rem] leading-relaxed text-taupe">
                    {cat ? `"${cat.name}" başlığında` : 'Bu bölümde'} henüz yayınlanmış bir yazı yok. Uzman onayından geçen içerikler burada yayınlanacak.
                  </p>
                </div>
              )
            ) : (
              <>
                {first && page === 1 ? (
                  <Reveal className="grid gap-10 border-b border-espresso/12 pb-16 lg:grid-cols-12">
                    <div className="lg:col-span-12"><PostCard post={first} large /></div>
                  </Reveal>
                ) : null}
                <div className="mt-16 grid gap-x-10 gap-y-16 sm:grid-cols-2 lg:grid-cols-3">
                  {(page === 1 ? rest : posts).map((p, i) => (
                    <Reveal key={p.id} delay={(i % 3) * 0.06}><PostCard post={p} /></Reveal>
                  ))}
                </div>
                {pages > 1 && (
                  <nav aria-label="Sayfalama" className="mt-20 flex items-center justify-center gap-2">
                    {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setParams(n === 1 ? {} : { sayfa: String(n) })}
                        aria-current={n === page ? 'page' : undefined}
                        className={cn('h-10 w-10 rounded-full text-[0.9rem] tabular-nums', n === page ? 'bg-espresso text-cream' : 'text-taupe hover:bg-sand')}
                      >
                        {n}
                      </button>
                    ))}
                  </nav>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      {showFaq && site.faqs.length > 0 && (
        <section id="sss" className="bg-cream text-espresso" aria-labelledby="faq-title">
          <div className="container-edge grid gap-12 py-24 sm:py-32 lg:grid-cols-12 lg:gap-x-10">
            <div className="lg:col-span-4">
              <p className="text-[0.7rem] font-semibold tracking-[0.22em] text-taupe uppercase">Sık sorulan sorular</p>
              <h2 id="faq-title" className="mt-6 font-display text-[clamp(2.2rem,1.6rem+2vw,3.4rem)] leading-[1.05] font-medium">
                Aklınıza takılanlar
              </h2>
            </div>
            <div className="lg:col-span-7 lg:col-start-6">
              <FaqList faqs={site.faqs} />
            </div>
          </div>
        </section>
      )}
    </>
  );
}
