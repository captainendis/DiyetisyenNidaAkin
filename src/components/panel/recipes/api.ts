// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import { recipeImageUrl, type PrintRecipe, type Recipe } from '@shared/recipe';
import type { NutritionPlanData } from '@shared/plan';

/** Plan önizlemesi için tarif referanslarını kütüphaneden çözer (görsel: 480 px URL) */
export function printRecipesFor(plan: NutritionPlanData, library: Recipe[] | undefined): PrintRecipe[] {
  if (!library) return [];
  const byId = new Map(library.map((r) => [r.id, r]));
  return (plan.recipes?.items ?? []).flatMap((it) => {
    const r = byId.get(it.recipeId);
    if (!r) return [];
    return [{
      title: r.title, category: r.category, summary: r.summary, servings: r.servings, prepMinutes: r.prepMinutes,
      cookMinutes: r.cookMinutes, kcal: r.kcal, ingredients: r.ingredients, steps: r.steps, tip: r.tip,
      variantNote: r.variantNote, personal: !!r.clientId, label: it.label,
      image: r.imageBase ? recipeImageUrl(r.imageBase, 480) : null,
    }];
  });
}

/** Plan editöründe ve kütüphanede gösterilecek tarifler: genel tarifler + (varsa) bu danışana özel olanlar */
export function recipesVisibleFor(library: Recipe[], clientId: string | null | undefined) {
  return library
    .filter((r) => !r.clientId || r.clientId === clientId)
    .sort((a, b) => Number(!!b.clientId) - Number(!!a.clientId));
}
