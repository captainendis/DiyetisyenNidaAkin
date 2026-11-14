// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Tarif varyasyon notları (ör. "Laktozsuz, glutensiz ekmekle") sağlık bilgisi içerebileceği için
 * AES-256-GCM ile şifreli saklanır (recipes.variantNoteEnc). Boş not → null.
 */
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
