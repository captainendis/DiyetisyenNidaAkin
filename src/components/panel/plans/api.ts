// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import { ApiError } from '@/lib/api';
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

/** PDF'i indirir; hata olursa sunucunun Türkçe mesajıyla ApiError fırlatır */
export async function downloadPlanPdf(id: string) {
  const res = await fetch(`/api/plans/${id}/pdf`, { credentials: 'same-origin' });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body?.error?.code ?? 'ERROR', body?.error?.message ?? 'PDF oluşturulamadı');
  }
  const blob = await res.blob();
  const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? 'beslenme-plani.pdf';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return {
    fits: res.headers.get('x-plan-fits') !== 'false',
    scale: Number(res.headers.get('x-plan-scale') ?? 1),
    pages: Number(res.headers.get('x-plan-pages') ?? 1),
    recipesFit: res.headers.get('x-plan-recipes-fit') !== 'false',
  };
}
