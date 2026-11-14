// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Tarif içeriği şifreleme (recipes.contentEnc, AES-256-GCM).
 * Kişiye özel tarifler sağlık bilgisi içerebildiği için (ör. "Glutensiz …", "laktozsuz süt") ad, kısa açıklama,
 * malzemeler, adımlar ve ipucu TÜM tariflerde şifreli tutulur; yayındaki tarifler sitede gösterilirken çözülür.
 * Kategori, porsiyon, süreler, kalori, görsel ve yayın bilgisi düz kalır (sıralama/süzme için; sağlık bilgisi değil).
 */
import { decryptJson, encryptJson } from '../lib/crypto';

export interface RecipeContent {
  title: string;
  summary: string;
  ingredients: string[];
  steps: string[];
  tip: string;
}

const EMPTY: RecipeContent = { title: '', summary: '', ingredients: [], steps: [], tip: '' };
const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const str = (v: unknown) => (typeof v === 'string' ? v : '');

export const encryptContent = (c: RecipeContent) =>
  encryptJson({ title: c.title, summary: c.summary, ingredients: c.ingredients, steps: c.steps, tip: c.tip });

/** Çözer; anahtar değiştiyse ya da veri bozuksa sayfa çökmesin diye boş içerik döner (hata günlüğe yazılır) */
export function decryptContent(enc: string | null | undefined): RecipeContent {
  if (!enc) return { ...EMPTY };
  try {
    const raw = decryptJson<Record<string, unknown>>(enc);
    return { title: str(raw.title), summary: str(raw.summary), ingredients: strings(raw.ingredients), steps: strings(raw.steps), tip: str(raw.tip) };
  } catch (e) {
    console.error('Tarif içeriği çözülemedi', e);
    return { ...EMPTY };
  }
}
