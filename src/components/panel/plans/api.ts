// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

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

/** Planın yazdırma sayfası; açılınca yazdırma penceresi gelir (hedef: "PDF olarak kaydet") */
export const planPrintUrl = (id: string) => `/api/plans/${id}/print?autoprint=1`;

/**
 * Yazdırma sayfasını yeni sekmede açar. Sekme tıklama anında açılır (açılır pencere engelleyicisine takılmaz);
 * `prepare` (ör. kaydetme) başarısız olursa sekme kapatılır.
 */
export async function openPlanPrint(id: string, prepare?: () => Promise<boolean>) {
  const w = window.open('', '_blank');
  if (w) w.opener = null;
  if (prepare && !(await prepare())) {
    w?.close();
    return false;
  }
  if (w) w.location.href = planPrintUrl(id);
  else window.location.href = planPrintUrl(id);
  return true;
}
