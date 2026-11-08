// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Tarif içeriği şifreleme (recipes.contentEnc, AES-256-GCM).
 * Kişiye özel tarifler sağlık bilgisi içerebildiği için (ör. "Glutensiz …", "laktozsuz süt") ad, kısa açıklama,
 * malzemeler, adımlar ve ipucu TÜM tariflerde şifreli tutulur; yayındaki tarifler sitede gösterilirken çözülür.
 * Kategori, porsiyon, süreler, kalori, görsel ve yayın bilgisi düz kalır (sıralama/süzme için; sağlık bilgisi değil).
 */
import { prisma } from '../lib/db';
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

const LEGACY_COLUMNS = ['title', 'summary', 'ingredients', 'steps', 'tip'] as const;

/**
 * Eski düz metin içerik sütunlarını şifreli alana taşır ve sütunları kaldırır. İdempotent; açılışta çalışır.
 * Yeni/boş kurulumda migration sütunları zaten silmiş olur ve bu fonksiyon hiçbir şey yapmaz.
 * Sütunlar Prisma şemasında olmadığı için ham SQL kullanılır.
 */
export async function encryptLegacyRecipeContent() {
  const cols = await prisma.$queryRaw<{ column_name: string }[]>`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'recipes'
      AND column_name IN ('title', 'summary', 'ingredients', 'steps', 'tip')`;
  if (!cols.length) return 0;
  const has = new Set(cols.map((c) => c.column_name));
  const pick = (c: string, fallback: string) => (has.has(c) ? `"${c}"` : fallback);

  // Yalnızca henüz şifreli içeriği olmayan satırlar (yeni sürümde oluşturulmuş/düzenlenmiş olanlar dokunulmaz)
  const rows = await prisma.$queryRawUnsafe<{ id: string; title: unknown; summary: unknown; ingredients: unknown; steps: unknown; tip: unknown }[]>(
    `SELECT id, ${pick('title', 'NULL')} AS title, ${pick('summary', 'NULL')} AS summary, ${pick('ingredients', 'NULL')} AS ingredients,
            ${pick('steps', 'NULL')} AS steps, ${pick('tip', 'NULL')} AS tip
     FROM "recipes" WHERE "contentEnc" IS NULL`,
  );
  let moved = 0;
  for (const r of rows) {
    const enc = encryptContent({ title: str(r.title), summary: str(r.summary), ingredients: strings(r.ingredients), steps: strings(r.steps), tip: str(r.tip) });
    moved += await prisma.$executeRaw`UPDATE "recipes" SET "contentEnc" = ${enc} WHERE id = ${r.id} AND "contentEnc" IS NULL`;
  }
  // Hepsi taşındıysa düz metin sütunlarını kaldır
  const left = await prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM "recipes" WHERE "contentEnc" IS NULL`;
  if (Number(left[0]?.n) === 0) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "recipes" ${LEGACY_COLUMNS.map((c) => `DROP COLUMN IF EXISTS "${c}"`).join(', ')}`);
  }
  return moved;
}
