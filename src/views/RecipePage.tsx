// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

'use client';

/** /tarifler/:slug — yayınlanmış tarif (Schema.org Recipe verisiyle) */
import { useEffect, useState } from 'react';
import { Link, useParams } from '@/lib/router';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/sections/PageHeader';
import { PublicRecipeCardView, RecipeImage } from '@/components/cards/RecipeCard';
import { CtaBand } from '@/components/sections/CtaBand';
import { Seo, SITE_URL } from '@/components/seo/Seo';
import { RECIPE_CATEGORY_LABEL, recipeImageUrl, type PublicRecipe, type PublicRecipeCard } from '@shared/recipe';
import NotFoundPage from './NotFoundPage';

const iso = (m: number | null) => (m ? `PT${m}M` : undefined);

export default function RecipePage() {
  const { slug } = useParams();
  const [data, setData] = useState<{ recipe: PublicRecipe; related: PublicRecipeCard[] } | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let alive = true;
    setData(null);
    setMissing(false);
    api
      .get<{ recipe: PublicRecipe; related: PublicRecipeCard[] }>(`/public/recipes/${encodeURIComponent(slug ?? '')}`)
      .then((r) => alive && setData(r))
      .catch(() => alive && setMissing(true));
    return () => {
      alive = false;
    };
  }, [slug]);

  if (missing) return <NotFoundPage />;
  if (!data) return <div className="min-h-dvh bg-espresso" aria-busy="true" />;
  const { recipe: r, related } = data;
  const crumbs = [{ name: 'Tarifler', path: '/tarifler' }, { name: r.title, path: `/tarifler/${r.slug}` }];
  const description = r.summary || `${r.title} tarifi: ${r.ingredients.slice(0, 4).join(', ')}.`;
  const image = r.imageBase ? `${SITE_URL}${recipeImageUrl(r.imageBase, 960)}` : undefined;
  const total = (r.prepMinutes ?? 0) + (r.cookMinutes ?? 0);
  const facts = [
    r.servings ? { k: 'Porsiyon', v: String(r.servings) } : null,
    r.prepMinutes ? { k: 'Hazırlık', v: `${r.prepMinutes} dk` } : null,
    r.cookMinutes ? { k: 'Pişirme', v: `${r.cookMinutes} dk` } : null,
    r.kcal ? { k: 'Porsiyonu', v: `~${r.kcal} kcal` } : null,
  ].filter((x): x is { k: string; v: string } => !!x);

  return (
    <>
      <Seo
        title={`${r.title} tarifi`}
        description={description}
        type="article"
        image={image}
        breadcrumbs={crumbs}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'Recipe',
          name: r.title,
          description,
          inLanguage: 'tr-TR',
          recipeCategory: RECIPE_CATEGORY_LABEL[r.category],
          recipeCuisine: 'Türk',
          ...(image ? { image: [image] } : {}),
          ...(r.servings ? { recipeYield: `${r.servings} porsiyon` } : {}),
          ...(iso(r.prepMinutes) ? { prepTime: iso(r.prepMinutes) } : {}),
          ...(iso(r.cookMinutes) ? { cookTime: iso(r.cookMinutes) } : {}),
          ...(total ? { totalTime: `PT${total}M` } : {}),
          ...(r.kcal ? { nutrition: { '@type': 'NutritionInformation', calories: `${r.kcal} kcal` } } : {}),
          recipeIngredient: r.ingredients,
          recipeInstructions: r.steps.map((text, i) => ({ '@type': 'HowToStep', position: i + 1, text })),
          ...(r.publishedAt ? { datePublished: r.publishedAt } : {}),
          author: { '@type': 'Person', name: 'Nida Akın' },
        }}
      />
      <PageHeader
        title={r.title}
        crumbs={crumbs.slice(0, -1)}
        eyebrow={RECIPE_CATEGORY_LABEL[r.category]}
        lead={r.variantNote || r.summary ? <>{r.variantNote && <span className="block font-semibold text-rose">{r.variantNote}</span>}{r.summary}</> : undefined}
      />
      <article className="bg-ivory text-espresso">
        <div className="container-edge grid gap-12 py-16 sm:py-24 lg:grid-cols-12 lg:gap-x-10">
          <div className="lg:col-span-7">
            <RecipeImage recipe={r} eager />
          </div>
          <aside className="lg:col-span-4 lg:col-start-9 lg:self-end">
            {facts.length > 0 && (
              <dl className="grid grid-cols-2 gap-px overflow-hidden border border-espresso/12 bg-espresso/12">
                {facts.map((f) => (
                  <div key={f.k} className="bg-ivory px-5 py-4">
                    <dt className="text-[0.7rem] font-semibold tracking-[0.18em] text-taupe uppercase">{f.k}</dt>
                    <dd className="mt-1 font-display text-[1.7rem] leading-none tabular-nums">{f.v}</dd>
                  </div>
                ))}
              </dl>
            )}
          </aside>

          <section className="lg:col-span-4" aria-labelledby="ing-title">
            <h2 id="ing-title" className="font-display text-[2rem] font-medium">Malzemeler</h2>
            <ul className="mt-6 divide-y divide-espresso/10 border-y border-espresso/10">
              {r.ingredients.map((i) => (
                <li key={i} className="flex gap-3 py-3 text-[1rem] leading-relaxed">
                  <span aria-hidden className="mt-[0.7em] h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                  {i}
                </li>
              ))}
            </ul>
          </section>
          <section className="lg:col-span-7 lg:col-start-6" aria-labelledby="steps-title">
            <h2 id="steps-title" className="font-display text-[2rem] font-medium">Hazırlanışı</h2>
            <ol className="mt-6 space-y-6">
              {r.steps.map((s, i) => (
                <li key={i} className="flex gap-5">
                  <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-espresso/30 font-display text-[1.15rem] tabular-nums">{i + 1}</span>
                  <p className="pt-1 text-[1.02rem] leading-[1.75] text-cocoa">{s}</p>
                </li>
              ))}
            </ol>
            {r.tip && (
              <p className="mt-10 border-l-2 border-gold bg-cream/70 px-6 py-5 text-[0.98rem] leading-relaxed text-cocoa">
                <strong className="font-semibold text-espresso">İpucu. </strong>{r.tip}
              </p>
            )}
            <aside className="mt-10 text-[0.88rem] leading-relaxed text-taupe" role="note">
              Bu tarif genel bir öneridir; porsiyon ve içerik kişiden kişiye değişebilir. Sağlık durumunuza özel beslenme planı için bir diyetisyene danışın.
            </aside>
            <div className="mt-10 border-t border-espresso/12 pt-8">
              <Link to="/tarifler" className="text-[0.92rem] text-taupe hover:text-espresso">← Tüm tarifler</Link>
            </div>
          </section>
        </div>
      </article>
      {related.length > 0 && (
        <section className="bg-cream text-espresso" aria-labelledby="related-title">
          <div className="container-edge py-20 sm:py-28">
            <h2 id="related-title" className="font-display text-[2.2rem] font-medium">Benzer tarifler</h2>
            <div className="mt-12 grid gap-x-10 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((x) => <PublicRecipeCardView key={x.slug} recipe={x} />)}
            </div>
          </div>
        </section>
      )}
      <CtaBand />
    </>
  );
}
