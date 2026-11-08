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

/** Ana sayfada aynı anda gösterilebilecek en fazla tarif */
export const MAX_FEATURED_RECIPES = 3;

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
  /** Web sitesinde /tarifler altında yayınlansın mı (kişiye özel varyasyonlarda her zaman false) */
  isPublished: z.boolean().default(false),
  /** Ana sayfadaki "Mutfaktan" şeridinde göster (yalnızca yayındaki, kişiye özel olmayan tarifler; en fazla MAX_FEATURED) */
  isFeatured: z.boolean().default(false),
  /** Varyasyonda neyin değiştiği; danışanın PDF'inde "Sana özel" notu olarak görünür */
  variantNote: z.string().trim().max(120).default(''),
  /** Kişiye özel varyasyon: bağlı danışan */
  clientId: z.string().max(40).nullable().default(null),
});
export type RecipeInput = z.infer<typeof recipeInputSchema>;

/** Yeni tarif: isteğe bağlı olarak bir tarifin varyasyonu olarak (fotoğrafı da kopyalanarak) oluşturulur */
export const recipeCreateSchema = recipeInputSchema.extend({
  parentId: z.string().max(40).nullable().default(null),
  copyImage: z.boolean().default(false),
});

export interface Recipe extends RecipeInput {
  id: string;
  /** /uploads/public/recipes/<id> — dosyalar: <base>-480.webp, <base>-960.webp */
  imageBase: string | null;
  slug: string | null;
  publishedAt: string | null;
  /** Ana sayfaya eklenme zamanı (şeritteki sıra) */
  featuredAt: string | null;
  parentId: string | null;
  parent: { id: string; title: string } | null;
  client: { id: string; firstName: string; lastName: string } | null;
  variantCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Sitede gösterilen tarif (kişisel/iç alanlar yok) */
export interface PublicRecipeCard {
  slug: string;
  title: string;
  category: RecipeCategory;
  summary: string;
  variantNote: string;
  servings: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  kcal: number | null;
  imageBase: string | null;
  publishedAt: string | null;
}
export interface PublicRecipe extends PublicRecipeCard {
  ingredients: string[];
  steps: string[];
  tip: string;
  updatedAt: string;
}

/** Panelde varyasyonun kısa adı: "Yulaflı tost · Ayşe Y. için · Laktozsuz" */
export function recipeDisplayName(r: Pick<Recipe, 'title' | 'variantNote' | 'client'>) {
  return [r.title, r.client ? `${r.client.firstName} ${r.client.lastName.charAt(0)}. için` : '', r.variantNote].filter(Boolean).join(' · ');
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
  /** Varyasyon notu (ör. "Laktozsuz") */
  variantNote: string;
  /** Danışana özel varyasyon mu ("Sana özel" olarak basılır) */
  personal: boolean;
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
