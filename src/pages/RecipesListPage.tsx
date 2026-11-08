// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** /tarifler — panelde "Web sitesinde yayınla" işaretlenen tarifler (kişiye özel varyasyonlar hiçbir zaman görünmez) */
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/sections/PageHeader';
import { PublicRecipeCardView } from '@/components/cards/RecipeCard';
import { Reveal } from '@/components/motion/Reveal';
import { Seo, SITE_URL } from '@/components/seo/Seo';
import { Sprig } from '@/components/icons/Botanical';
import { cn } from '@/lib/text';
import { RECIPE_CATEGORIES, RECIPE_CATEGORY_LABEL, type PublicRecipeCard, type RecipeCategory } from '@shared/recipe';

export default function RecipesListPage() {
  const [params] = useSearchParams();
  const raw = params.get('kategori') ?? '';
  const category = (RECIPE_CATEGORIES as readonly string[]).includes(raw.toUpperCase()) ? (raw.toUpperCase() as RecipeCategory) : undefined;
  const [data, setData] = useState<{ recipes: PublicRecipeCard[]; counts: Partial<Record<RecipeCategory, number>> } | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    setError(false);
    api
      .get<{ recipes: PublicRecipeCard[]; counts: Partial<Record<RecipeCategory, number>> }>('/public/recipes', { category })
      .then((r) => alive && setData(r))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [category]);

  const crumbs = [{ name: 'Tarifler', path: '/tarifler' }];
  const cats = RECIPE_CATEGORIES.filter((c) => data?.counts[c]);
  const recipes = data?.recipes ?? [];

  return (
    <>
      <Seo
        title={category ? `${RECIPE_CATEGORY_LABEL[category]} tarifleri` : 'Tarifler'}
        description="Diyetisyen Nida Akın’ın önerdiği pratik ve dengeli tarifler. Genel öneridir; kişiye özel planın yerine geçmez."
        breadcrumbs={crumbs}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: 'Tarifler',
          url: `${SITE_URL}/tarifler`,
          itemListElement: recipes.map((r, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE_URL}/tarifler/${r.slug}` })),
        }}
      />
      <PageHeader
        title="Tarifler"
        crumbs={crumbs}
        lead="Danışanlarımla en çok paylaştığım, pratik ve dengeli tarifler. Porsiyonlar genel öneridir; kendi planınıza göre uyarlamak için bir uzmana danışın."
      />
      <section className="bg-ivory text-espresso">
        <div className="container-edge py-14 sm:py-20">
          {cats.length > 1 && (
            <nav aria-label="Tarif kategorileri" className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
              <ul className="flex min-w-max gap-7 border-b border-espresso/12">
                {[undefined, ...cats].map((c) => {
                  const active = c === category;
                  return (
                    <li key={c ?? 'all'}>
                      <Link
                        to={c ? `/tarifler?kategori=${c.toLowerCase()}` : '/tarifler'}
                        aria-current={active ? 'page' : undefined}
                        className={cn('-mb-px block border-b py-4 text-[0.92rem] transition-colors', active ? 'border-espresso text-espresso' : 'border-transparent text-taupe hover:text-espresso')}
                      >
                        {c ? RECIPE_CATEGORY_LABEL[c] : 'Tümü'}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          )}
          <div className="pt-14 sm:pt-20">
            {error ? (
              <p className="py-16 text-center text-taupe">Tarifler şu an yüklenemedi. Lütfen daha sonra tekrar deneyin.</p>
            ) : !data ? (
              <div className="grid gap-10 md:grid-cols-3" aria-busy="true" aria-label="Yükleniyor">
                {[0, 1, 2].map((i) => <div key={i} className="aspect-[4/3] animate-pulse bg-sand/70" />)}
              </div>
            ) : recipes.length === 0 ? (
              <div className="mx-auto flex max-w-lg flex-col items-center py-16 text-center">
                <Sprig className="w-24 text-gold" />
                <p className="mt-8 font-display text-[2.2rem] leading-tight">Tarifler hazırlanıyor.</p>
                <p className="mt-3 text-[1rem] leading-relaxed text-taupe">Bu bölümde henüz yayınlanmış bir tarif yok.</p>
              </div>
            ) : (
              <div className="grid gap-x-10 gap-y-16 sm:grid-cols-2 lg:grid-cols-3">
                {recipes.map((r, i) => (
                  <Reveal key={r.slug} delay={(i % 3) * 0.06}><PublicRecipeCardView recipe={r} /></Reveal>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
