// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import { beforeAll, describe, expect, it } from 'vitest';

// env.ts import sırasında doğrulanır; anahtar yoksa test için geçici bir tane kurulur
let content: typeof import('../server/services/recipe-content');
let crypto: typeof import('../server/lib/crypto');

beforeAll(async () => {
  process.env.DATA_ENCRYPTION_KEY ||= Buffer.alloc(32, 7).toString('base64');
  process.env.DATABASE_URL ||= 'mysql://x:x@localhost:3306/x';
  content = await import('../server/services/recipe-content');
  crypto = await import('../server/lib/crypto');
});

const full = { title: 'Kek', summary: '', ingredients: ['un'], steps: ['pişir'], tip: '' };

describe('tarif içeriği şifreleme', () => {
  it('diyet türleri şifreli içerikte gidip gelir', () => {
    const enc = content.encryptContent({ ...full, dietTags: ['VEGETARIAN', 'GLUTEN_FREE'] });
    expect(enc).not.toContain('GLUTEN_FREE');
    expect(content.decryptContent(enc).dietTags).toEqual(['VEGETARIAN', 'GLUTEN_FREE']);
  });
  it('bilinmeyen etiketleri atar', () => {
    const enc = crypto.encryptJson({ ...full, dietTags: ['KETO', 'VEGAN', 5, 'GLUTEN_FREE'] });
    expect(content.decryptContent(enc).dietTags).toEqual(['VEGAN', 'VEGETARIAN', 'GLUTEN_FREE']);
  });
  it('alanı olmayan eski satırlar boş dizi döner', () => {
    expect(content.decryptContent(crypto.encryptJson(full)).dietTags).toEqual([]);
    expect(content.decryptContent(null).dietTags).toEqual([]);
  });
});
