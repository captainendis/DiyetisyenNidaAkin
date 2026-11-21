// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Beslenme planı tipleri ve yardımcıları (web: src/components/panel/plans/api.ts) */
import { api } from '@/lib/api';
import type { NutritionPlanData } from '@shared/plan';

export interface PlanListItem {
  id: string;
  name: string;
  isTemplate: boolean;
  clientId: string | null;
  createdAt: string;
  updatedAt: string;
  client: { id: string; firstName: string; lastName: string } | null;
}
export interface PlanDetail extends PlanListItem {
  data: NutritionPlanData;
}

/** Sunucunun A4 yazdırma sayfası (api.printPdf bunu cihazda PDF'e çevirip paylaşır) */
export const planPrintPath = (id: string) => `/plans/${id}/print`;

/** Planı PDF olarak paylaş */
export const sharePlanPdf = (id: string, name: string) => api.printPdf(planPrintPath(id), name || 'Beslenme planı');

export const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** Kaydetmeden önce boş satırları temizle */
export const tidyPlan = (d: NutritionPlanData): NutritionPlanData => ({
  ...d,
  meals: d.meals.map((m) => ({ ...m, options: m.options.map((o) => o.map((l) => l.trim()).filter(Boolean)) })),
  habits: { ...d.habits, items: d.habits.items.filter((h) => h.title.trim() || h.text.trim()) },
  portions: { ...d.portions, items: d.portions.items.filter((p) => p.name.trim() || p.amount.trim()) },
});

export type PlanSetter = (fn: (d: NutritionPlanData) => void) => void;
