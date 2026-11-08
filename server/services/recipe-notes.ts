// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Tarif varyasyon notları (ör. "Laktozsuz, glutensiz ekmekle") sağlık bilgisi içerebileceği için
 * AES-256-GCM ile şifreli saklanır (recipes.variantNoteEnc). Boş not → null.
 */
import { prisma } from '../lib/db';
import { decryptString, encryptString } from '../lib/crypto';

export const encryptNote = (note: string) => (note.trim() ? encryptString(note.trim()) : null);

export function decryptNote(enc: string | null | undefined): string {
  if (!enc) return '';
  try {
    return decryptString(enc);
  } catch (e) {
    // Anahtar değiştiyse ya da veri bozuksa sayfa çökmesin; not boş görünür
    console.error('Varyasyon notu çözülemedi', e);
    return '';
  }
}

/**
 * Eski düz metin varyasyon notlarını (recipes."variantNote") şifreli sütuna taşır, ardından sütunu kaldırır.
 * Normalde sütun 20261108210000 migration'ıyla silinmiş olur ve bu fonksiyon hiçbir şey yapmaz. Sunucu,
 * notların henüz taşınmadığı bir sürümden doğrudan güncellendiyse migration sütunu (veri kaybı olmasın diye)
 * bırakır; bu durumda notlar burada şifrelenip sütun silinir. Sütun Prisma şemasında olmadığı için ham SQL
 * kullanılır. İdempotent; açılışta çalışır.
 */
export async function encryptLegacyVariantNotes() {
  const col = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT count(*) AS n FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'recipes' AND column_name = 'variantNote'`;
  if (!Number(col[0]?.n)) return 0;

  const rows = await prisma.$queryRaw<{ id: string; note: string }[]>`
    SELECT id, "variantNote" AS note FROM "recipes" WHERE "variantNote" <> ''`;
  let moved = 0;
  for (const r of rows) {
    // Şifreli not zaten varsa (yeni sürümde düzenlenmiş) üzerine yazma; yalnızca düz metni sil
    moved += await prisma.$executeRaw`
      UPDATE "recipes"
      SET "variantNoteEnc" = COALESCE("variantNoteEnc", ${encryptNote(r.note)}), "variantNote" = ''
      WHERE id = ${r.id} AND "variantNote" = ${r.note}`;
  }
  await prisma.$executeRawUnsafe('ALTER TABLE "recipes" DROP COLUMN IF EXISTS "variantNote"');
  return moved;
}
