// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Ana sayfa "Mutfaktan" şeridi: panelde "Ana sayfada göster" seçilen tarifler (en fazla 3);
 * hiç seçilmemişse son yayınlananlar. Yayınlanmış tarif yoksa hiç çizilmez.
 */
import { useEffect, useState } from 'react';
import { Link } from '@/lib/router';
import { api } from '@/lib/api';
import { useSite } from '@/data/SiteContext';
import { Reveal } from '@/components/motion/Reveal';
import { PublicRecipeCardView } from '@/components/cards/RecipeCard';
import type { PublicRecipeCard } from '@shared/recipe';

export function RecentRecipes() {
  const { site } = useSite();
  const [recipes, setRecipes] = useState<PublicRecipeCard[] | null>(null);

  useEffect(() => {
    if (!site.recipeCount) return;
    let alive = true;
    api
      .get<{ recipes: PublicRecipeCard[] }>('/public/recipes/home')
      .then((r) => alive && setRecipes(r.recipes))
      .catch(() => alive && setRecipes([]));
    return () => {
      alive = false;
    };
  }, [site.recipeCount]);

  if (!site.recipeCount || !recipes?.length) return null;
  const t = site.settings.recipesSection;
  return (
    <section className="bg-cream text-espresso" aria-labelledby="recipes-title">
      <div className="container-edge py-24 sm:py-32">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <Reveal>
            <h2 id="recipes-title" className="font-display text-[clamp(2.4rem,1.6rem+2.6vw,4rem)] leading-[1.02] font-medium">{t.heading}</h2>
            {t.intro && <p className="mt-4 max-w-xl text-[1rem] leading-relaxed text-taupe">{t.intro}</p>}
          </Reveal>
          <Reveal delay={0.1}>
            <Link to="/tarifler" className="group inline-flex items-center gap-2 text-[0.95rem] font-medium text-cocoa hover:text-espresso">
              {site.recipeCount > recipes.length ? `${t.linkLabel} (${site.recipeCount})` : t.linkLabel}
              <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
            </Link>
          </Reveal>
        </div>
        <div className="mt-14 grid gap-x-10 gap-y-14 sm:mt-16 sm:grid-cols-2 lg:grid-cols-3">
          {recipes.map((r, i) => (
            <Reveal key={r.slug} delay={i * 0.08}><PublicRecipeCardView recipe={r} /></Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
