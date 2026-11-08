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
    const { id: _id, imageBase, createdAt: _c, updatedAt: _u, ...rest } = r;
    return [{ ...rest, label: it.label, image: imageBase ? recipeImageUrl(imageBase, 480) : null }];
  });
}
