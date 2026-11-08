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
 * Eski düz metin notları şifreli sütuna taşır ve düz metni siler. İdempotent; açılışta çalışır.
 * Her satır, düz metnin değişmediği koşuluyla güncellenir (eşzamanlı düzenlemeyle yarışmaz).
 */
export async function encryptLegacyVariantNotes() {
  const rows = await prisma.recipe.findMany({ where: { variantNote: { not: '' } }, select: { id: true, variantNote: true } });
  let moved = 0;
  for (const r of rows) {
    const res = await prisma.recipe.updateMany({
      where: { id: r.id, variantNote: r.variantNote },
      data: { variantNoteEnc: encryptNote(r.variantNote), variantNote: '' },
    });
    moved += res.count;
  }
  return moved;
}
