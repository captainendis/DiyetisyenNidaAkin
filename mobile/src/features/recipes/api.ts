// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Tarif kütüphanesi: sorgu, görsel adresi, danışana göre süzme (web: src/components/panel/recipes/api.ts) */
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { API_URL } from '@/lib/config';
import { useApiQuery } from '@/lib/query';
import { recipeImageUrl, type Recipe } from '@shared/recipe';

export interface ClientRef {
  id: string;
  firstName: string;
  lastName: string;
}

/** Tüm kütüphane (en fazla 500 tarif; arama/süzme bellekte) */
export function useRecipeLibrary(enabled = true) {
  return useApiQuery(['recipes'], () => api.get<{ items: Recipe[] }>('/recipes'), { enabled });
}

/** Herkese açık tarif görseli (yetki gerekmez) */
export const recipeImage = (base: string | null | undefined, size: 480 | 960 = 480) => (base ? API_URL + recipeImageUrl(base, size) : null);

/** Plan editöründe gösterilecek tarifler: genel tarifler + (varsa) bu danışana özel olanlar (önce kişiye özel) */
export function recipesVisibleFor(library: Recipe[], clientId: string | null | undefined) {
  return library
    .filter((r) => !r.clientId || r.clientId === clientId)
    .sort((a, b) => Number(!!b.clientId) - Number(!!a.clientId));
}

export const normTr = (s: string) => s.toLocaleLowerCase('tr-TR');

export function useDebounced<T>(value: T, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
