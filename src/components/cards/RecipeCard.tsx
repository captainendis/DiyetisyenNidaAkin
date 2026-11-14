// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import { Link } from '@/lib/router';
import { Sprig } from '@/components/icons/Botanical';
import { DietBadges } from '@/components/recipes/DietBadges';
import { cn } from '@/lib/text';
import { RECIPE_CATEGORY_LABEL, recipeImageUrl, type PublicRecipeCard } from '@shared/recipe';

export function RecipeImage({ recipe, className, eager }: { recipe: Pick<PublicRecipeCard, 'imageBase' | 'category'>; className?: string; eager?: boolean }) {
  if (recipe.imageBase) {
    return (
      <img
        src={recipeImageUrl(recipe.imageBase, 960)}
        srcSet={`${recipeImageUrl(recipe.imageBase, 480)} 480w, ${recipeImageUrl(recipe.imageBase, 960)} 960w`}
        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
        alt=""
        width={960}
        height={720}
        loading={eager ? 'eager' : 'lazy'}
        className={cn('aspect-[4/3] w-full object-cover', className)}
      />
    );
  }
  return (
    <div className={cn('relative flex aspect-[4/3] w-full items-end overflow-hidden bg-[linear-gradient(150deg,#3b2b20_0%,#302219_60%,#211710_100%)] p-6', className)} aria-hidden>
      <Sprig className="absolute top-6 right-6 w-24 text-gold/40" />
      <span className="font-display text-[1.05rem] text-rose/80 italic">{RECIPE_CATEGORY_LABEL[recipe.category]}</span>
    </div>
  );
}

const time = (r: PublicRecipeCard) => (r.prepMinutes ?? 0) + (r.cookMinutes ?? 0);

export function PublicRecipeCardView({ recipe }: { recipe: PublicRecipeCard }) {
  const total = time(recipe);
  return (
    <article className="group">
      <Link to={`/tarifler/${recipe.slug}`} className="block">
        <div className="overflow-hidden">
          <RecipeImage recipe={recipe} className="transition-transform duration-[1.2s] ease-[var(--ease-soft)] group-hover:scale-[1.03]" />
        </div>
        <div className="mt-5 flex items-center gap-3 text-[0.72rem] font-semibold tracking-[0.16em] text-taupe uppercase">
          <span>{RECIPE_CATEGORY_LABEL[recipe.category]}</span>
          {total > 0 && <><span aria-hidden className="h-px w-5 bg-gold/60" /><span>{total} dk</span></>}
        </div>
        <h3 className="mt-3 font-display text-[1.6rem] leading-[1.12] font-medium text-espresso transition-colors group-hover:text-cocoa">{recipe.title}</h3>
        {recipe.variantNote && <p className="mt-1 text-[0.85rem] font-semibold text-cocoa/80">{recipe.variantNote}</p>}
        <DietBadges tags={recipe.dietTags} className="mt-3" />
        {recipe.summary && <p className="mt-3 text-[0.95rem] leading-relaxed text-cocoa/75">{recipe.summary}</p>}
      </Link>
    </article>
  );
}
