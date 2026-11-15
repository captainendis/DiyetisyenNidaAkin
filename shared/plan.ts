// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Beslenme planı veri modeli (panel düzenleyici, sunucu doğrulaması ve PDF şablonu ortak kullanır).
 * Düzen, diyetisyenin kullandığı tek sayfalık A4 plan örneğini temel alır.
 */
import { z } from 'zod';

const line = z.string().trim().max(120);

export const MAX_PLAN_RECIPES = 8;

/**
 * Plan renk temaları (PDF şablonu ve paneldeki seçici ortak kullanır).
 * Her tema WCAG AA'yı sağlar: ink zemin/kart/çip üzerinde ≥ 7:1, muted ≥ 4,5:1,
 * koyu kutuda darkInk ≥ 7:1 ve darkAccent ≥ 4,5:1, ink vurgu üzerinde ≥ 4,5:1 (tarif etiketi).
 * Yeni tema eklerken bu oranları koru; id'ler kayıtlı planlarda saklandığı için değiştirilmez.
 */
export interface PlanThemeColors {
  bg: string; ink: string; muted: string; accent: string; card: string; chip: string; line: string;
  /** Alışkanlıklar kutusunun zemini, metni ve başlık vurgusu */
  dark: string; darkInk: string; darkAccent: string;
}
export const PLAN_THEME_IDS = ['green', 'brand', 'citrus', 'plum', 'sea', 'mono'] as const;
export type PlanThemeId = (typeof PLAN_THEME_IDS)[number];
export const PLAN_THEMES: Record<PlanThemeId, { label: string; note: string; colors: PlanThemeColors }> = {
  green: {
    label: 'Adaçayı', note: 'Örnek plandaki yeşil',
    colors: { bg: '#EDF0E5', ink: '#1E3326', muted: '#5D6B60', accent: '#E3AE1E', card: '#FFFFFF', chip: '#E6EBDD', line: '#C7CFBD', dark: '#1F3326', darkInk: '#F1F3EC', darkAccent: '#E9B728' },
  },
  brand: {
    label: 'Marka', note: 'Kahve ve krem',
    colors: { bg: '#F6EFE4', ink: '#2A1D14', muted: '#6E5A4B', accent: '#C99282', card: '#FFFDF9', chip: '#EFE5D6', line: '#DCCDB8', dark: '#302219', darkInk: '#F4EBDD', darkAccent: '#DDAFA0' },
  },
  citrus: {
    label: 'Narenciye', note: 'Limon sarısı, portakal',
    colors: { bg: '#FBF4DF', ink: '#2B2A12', muted: '#635E3E', accent: '#EE8A2B', card: '#FFFFFF', chip: '#F4EBCB', line: '#E2D6AE', dark: '#3A3A16', darkInk: '#FBF4DF', darkAccent: '#F5A04A' },
  },
  plum: {
    label: 'Erik', note: 'Mürdüm ve pembe',
    colors: { bg: '#F3EEF2', ink: '#2E1A2B', muted: '#65525F', accent: '#DE96B4', card: '#FFFFFF', chip: '#EBE2E9', line: '#D6C8D2', dark: '#3B2036', darkInk: '#F6EFF4', darkAccent: '#E9A3C0' },
  },
  sea: {
    label: 'Deniz', note: 'Petrol mavisi, kum',
    colors: { bg: '#EAF1F3', ink: '#14303A', muted: '#4F646B', accent: '#E7B85A', card: '#FFFFFF', chip: '#DFEAED', line: '#C2D3D8', dark: '#17363F', darkInk: '#EEF4F5', darkAccent: '#F0C670' },
  },
  mono: {
    label: 'Yazıcı dostu', note: 'Siyah beyaz, az mürekkep',
    colors: { bg: '#FFFFFF', ink: '#111111', muted: '#555555', accent: '#D4D4D4', card: '#FFFFFF', chip: '#F1F1F1', line: '#BDBDBD', dark: '#F1F1F1', darkInk: '#111111', darkAccent: '#111111' },
  },
};

export const planMealSchema = z.object({
  /** "06.30" gibi serbest saat metni */
  time: z.string().trim().max(12),
  name: z.string().trim().max(40),
  /** En fazla 3 seçenek; her seçenek satırlardan oluşur */
  options: z.array(z.array(line).max(10)).min(1).max(3),
});

export const nutritionPlanDataSchema = z.object({
  title: z.string().trim().min(1, 'Başlık gerekli').max(60),
  subtitle: z.string().trim().max(160),
  theme: z.enum(PLAN_THEME_IDS).default('green'),
  water: z.object({
    show: z.boolean(),
    liters: z.string().trim().max(10),
    glasses: z.number().int().min(0).max(30),
    glassMl: z.number().int().min(0).max(1000),
  }),
  activity: z.object({
    show: z.boolean(),
    label: z.string().trim().max(40),
  }),
  meals: z.array(planMealSchema).max(7),
  habits: z.object({
    title: z.string().trim().max(60),
    items: z.array(z.object({ title: z.string().trim().max(30), text: z.string().trim().max(220) })).max(6),
  }),
  portions: z.object({
    title: z.string().trim().max(40),
    items: z.array(z.object({ name: z.string().trim().max(24), amount: z.string().trim().max(24) })).max(12),
  }),
  footerNote: z.string().trim().max(160),
  /** İmza satırı (ör. "Dyt. Nida Akın, 05xx xxx xx xx") */
  signature: z.string().trim().max(80),
  /** Tarif kütüphanesinden eklenen tarifler — planın arkasına ek sayfa(lar) olarak basılır */
  recipes: z
    .object({
      title: z.string().trim().max(60),
      items: z.array(z.object({ recipeId: z.string().min(1).max(40), label: z.string().trim().max(60) })).max(MAX_PLAN_RECIPES, `En fazla ${MAX_PLAN_RECIPES} tarif eklenebilir`),
    })
    .default({ title: 'Tarif önerileri', items: [] }),
});

export type NutritionPlanData = z.infer<typeof nutritionPlanDataSchema>;
export type PlanMeal = z.infer<typeof planMealSchema>;

export const planCreateSchema = z.object({
  clientId: z.string().max(40).nullable().optional(),
  isTemplate: z.boolean().default(false),
  name: z.string().trim().min(1, 'Plan adı gerekli').max(80),
  /** Bir şablondan / başka bir plandan kopyala */
  fromId: z.string().max(40).nullable().optional(),
  data: nutritionPlanDataSchema.optional(),
});
export const planUpdateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  data: nutritionPlanDataSchema.optional(),
});

/** Türkçe tamlayan (iyelik) eki: Ömer’in, Ayşe’nin, Nida’nın, Burak’ın, Gül’ün, Mustafa’nın */
export function genitive(name: string) {
  const n = name.trim();
  if (!n) return n;
  const vowels = n.toLocaleLowerCase('tr-TR').match(/[aeıioöuü]/g);
  const last = vowels?.[vowels.length - 1] ?? 'e';
  const harmony: Record<string, string> = { a: 'ı', ı: 'ı', e: 'i', i: 'i', o: 'u', u: 'u', ö: 'ü', ü: 'ü' };
  const v = harmony[last] ?? 'i';
  const endsVowel = /[aeıioöuü]$/i.test(n.toLocaleLowerCase('tr-TR'));
  return `${n}’${endsVowel ? 'n' : ''}${v}n`;
}

export function planTitleFor(firstName: string) {
  return `${genitive(firstName)} beslenme planı`;
}

const opt = (...lines: string[]) => lines;

/** Boş plan: öğün, başlık ya da hazır metin yok; yalnızca zorunlu plan başlığı ve imza */
export function emptyPlan(signature = 'Dyt. Nida Akın'): NutritionPlanData {
  return {
    title: 'Beslenme planı',
    subtitle: '',
    theme: 'green',
    water: { show: false, liters: '', glasses: 0, glassMl: 240 },
    activity: { show: false, label: '' },
    meals: [],
    habits: { title: '', items: [] },
    portions: { title: '', items: [] },
    footerNote: '',
    signature,
    recipes: { title: '', items: [] },
  };
}

/**
 * Diyetisyenin paylaştığı örnek plandan oluşturulan başlangıç şablonu ("1. ay, 1. liste").
 * İçerik diyetisyene aittir; danışana göre panelden düzenlenir.
 */
export function samplePlanTemplate(signature = 'Dyt. Nida Akın'): NutritionPlanData {
  return {
    title: 'Beslenme planı',
    subtitle: '1. ay, 1. liste. Her öğünde üç seçenekten yalnızca birini seç.',
    theme: 'green',
    water: { show: true, liters: '4,8', glasses: 20, glassMl: 240 },
    activity: { show: true, label: 'Yürüyüş, 30–45 dk' },
    meals: [
      {
        time: '06.30', name: 'Kahvaltı', options: [
          opt('2 haşlanmış yumurta', '3 dilim beyaz peynir', '5–6 zeytin', 'Söğüş sebze', '2–3 dilim tam tahıllı ekmek'),
          opt('Yulaf tost', 'Söğüş sebze', '5–6 zeytin', '2 dilim beyaz peynir'),
          opt('4 yulaf', '5–6 kaşık yoğurt', '1 tatlı kaşığı chia tohumu', 'Tarçın', '3 tam ceviz', '1 yeşil elma'),
        ],
      },
      {
        time: '10.00', name: 'Ara öğün', options: [
          opt('1 kupa çay', '2 dilim tam tahıllı ekmek', '2 dilim beyaz peynir', 'Yeşillik', '3 adet hindi füme'),
          opt('1 su bardağı sade kefir', '1 küçük muz'),
          opt('1 kupa kahve', '1 protein bar'),
        ],
      },
      {
        time: '16.00', name: 'Ara öğün', options: [
          opt('1 fincan kahve', '10 çiğ badem', '3 kuru kayısı'),
          opt('1 kupa bitki çayı', '12 çiğ fındık', '3–4 form kraker'),
          opt('1 quark yoğurt', '1 porsiyon meyve (sağ alttaki tablo)'),
        ],
      },
      {
        time: '19.30', name: 'Akşam yemeği', options: [
          opt('1 kase çorba', '10 kaşık sebze yemeği', '1 kase yoğurt', '2–3 dilim tam tahıllı ekmek'),
          opt('1 kase çorba', '6 fırın köfte', 'Salata', '2–3 dilim tam tahıllı ekmek', '1 su bardağı ayran'),
          opt('3 tavuk baget ya da 150 g tavuk göğüs, fırında ya da ızgara', 'Fırın sebze', '1 kase cacık', '2–3 dilim tam tahıllı ekmek'),
        ],
      },
    ],
    habits: {
      title: 'Planı taşıyan beş alışkanlık',
      items: [
        { title: 'Su.', text: 'Günde 4,8 litre, yani 20 bardak; tek seferde değil, güne yayarak iç.' },
        { title: 'Hareket.', text: 'Haftada en az 4–5 gün 30–45 dakika tempolu yürü, gün içinde de olabildiğince hareketli kal.' },
        { title: 'Öğün düzeni.', text: 'Öğünleri saatine yakın ye; öğün atlama, uzun süre aç kalma, porsiyonu koru.' },
        { title: 'Sebze ve lif.', text: 'Her gün çeşitli sebze, meyve ve lif kaynağı; sebzeyi mevsiminde seç.' },
        { title: 'Kaçamak olursa.', text: 'Plan dışı bir öğün haftayı bozmaz; bir sonraki öğünde kaldığın yerden devam et.' },
      ],
    },
    portions: {
      title: '1 porsiyon meyve',
      items: [
        { name: 'Kiraz', amount: '12 adet' }, { name: 'Dut', amount: '12 adet' }, { name: 'Kayısı', amount: '3 adet' },
        { name: 'Şeftali', amount: '1 orta boy' }, { name: 'Erik', amount: '10 adet' }, { name: 'Kavun', amount: '1 ince dilim' },
        { name: 'Çilek', amount: '8 adet' }, { name: 'Böğürtlen', amount: '15 adet' }, { name: 'Karpuz', amount: '2–3 dilim' },
      ],
    },
    footerNote: 'Bir öğün kaçarsa gün bozulmaz. Hedef kısa süreli değil, sürdürülebilir bir değişim.',
    signature,
    recipes: { title: 'Tarif önerileri', items: [] },
  };
}
