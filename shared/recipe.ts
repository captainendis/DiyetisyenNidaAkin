// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Tarif veri modeli (panel, sunucu doğrulaması ve plan ek sayfası ortak kullanır).
 * Tarifler danışana ait değildir; diyetisyenin kendi tarif kütüphanesidir ve planlara ek sayfa olarak eklenir.
 */
import { z } from 'zod';

export const RECIPE_CATEGORIES = ['BREAKFAST', 'SNACK', 'MAIN', 'SOUP', 'SALAD', 'DESSERT', 'DRINK'] as const;
export type RecipeCategory = (typeof RECIPE_CATEGORIES)[number];

export const RECIPE_CATEGORY_LABEL: Record<RecipeCategory, string> = {
  BREAKFAST: 'Kahvaltı',
  SNACK: 'Ara öğün',
  MAIN: 'Ana yemek',
  SOUP: 'Çorba',
  SALAD: 'Salata',
  DESSERT: 'Tatlı',
  DRINK: 'İçecek',
};

/** Plana eklenirken önerilen etiket (danışanın göreceği kısa açıklama) */
export const RECIPE_DEFAULT_LABEL: Record<RecipeCategory, string> = {
  BREAKFAST: 'Kahvaltı için öneri',
  SNACK: 'Ara öğün için öneri',
  MAIN: 'Ana öğün için öneri',
  SOUP: 'Çorba önerisi',
  SALAD: 'Salata önerisi',
  DESSERT: 'Tatlı isteği için',
  DRINK: 'İçecek önerisi',
};

const minutes = z.number().int().min(0, 'Geçersiz süre').max(1440, 'En fazla 1440 dk').nullable();

export const recipeInputSchema = z.object({
  title: z.string().trim().min(1, 'Tarif adı gerekli').max(80),
  category: z.enum(RECIPE_CATEGORIES, { error: 'Kategori seçin' }),
  summary: z.string().trim().max(200).default(''),
  servings: z.number().int().min(1, 'En az 1 porsiyon').max(24).nullable().default(null),
  prepMinutes: minutes.default(null),
  cookMinutes: minutes.default(null),
  /** Porsiyon başına yaklaşık enerji (kcal) */
  kcal: z.number().int().min(0).max(5000).nullable().default(null),
  ingredients: z.array(z.string().trim().min(1).max(120)).min(1, 'En az bir malzeme ekleyin').max(30, 'En fazla 30 malzeme'),
  steps: z.array(z.string().trim().min(1).max(500)).min(1, 'En az bir adım ekleyin').max(15, 'En fazla 15 adım'),
  tip: z.string().trim().max(300).default(''),
});
export type RecipeInput = z.infer<typeof recipeInputSchema>;

export interface Recipe extends RecipeInput {
  id: string;
  /** /uploads/public/recipes/<id> — dosyalar: <base>-480.webp, <base>-960.webp */
  imageBase: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Plan ek sayfasında çizilecek tarif (görsel: önizlemede URL, PDF'te data URI) */
export interface PrintRecipe {
  title: string;
  category: RecipeCategory;
  summary: string;
  servings: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  kcal: number | null;
  ingredients: string[];
  steps: string[];
  tip: string;
  image: string | null;
  /** Plandaki etiket, ör. "Kahvaltı için öneri" */
  label: string;
}

export const recipeImageUrl = (base: string, size: 480 | 960 = 480) => `${base}-${size}.webp`;

/** "2 porsiyon · 10 dk hazırlık · 15 dk pişirme · ~320 kcal" */
export function recipeMeta(r: Pick<RecipeInput, 'servings' | 'prepMinutes' | 'cookMinutes' | 'kcal'>) {
  return [
    r.servings ? `${r.servings} porsiyon` : '',
    r.prepMinutes ? `${r.prepMinutes} dk hazırlık` : '',
    r.cookMinutes ? `${r.cookMinutes} dk pişirme` : '',
    r.kcal ? `porsiyonu ~${r.kcal} kcal` : '',
  ].filter(Boolean);
}
