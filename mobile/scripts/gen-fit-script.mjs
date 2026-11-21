// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * shared/plan-template.ts → fitPlanToPage fonksiyonunu WebView'e enjekte edilecek JS metnine çevirir.
 * Hermes fonksiyon kaynağını (Function.toString) tutmadığı için metin derleme öncesi üretilir.
 * Çalıştırma: npm run gen:fit  ·  CI, üretilen dosyanın güncel olduğunu denetler.
 */
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const here = path.dirname(new URL(import.meta.url).pathname);
const src = fs.readFileSync(path.resolve(here, '../../shared/plan-template.ts'), 'utf8');
const start = src.indexOf('export function fitPlanToPage(');
if (start < 0) throw new Error('fitPlanToPage bulunamadı');
// Fonksiyon gövdesinin sonunu süslü parantez dengesiyle bul
let depth = 0;
let end = -1;
for (let i = src.indexOf('{', src.indexOf(')', start)); i < src.length; i++) {
  if (src[i] === '{') depth++;
  else if (src[i] === '}' && --depth === 0) { end = i + 1; break; }
}
const fn = src.slice(start, end).replace(/^export /, '');
const js = ts.transpileModule(fn, { compilerOptions: { target: ts.ScriptTarget.ES2019, removeComments: true } }).outputText.trim();

const out = `// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

// OTOMATİK ÜRETİLDİ — elle düzenlemeyin. Kaynak: shared/plan-template.ts (fitPlanToPage). Yenile: npm run gen:fit
export const FIT_PLAN_SOURCE = ${JSON.stringify(js)};
`;
const target = path.resolve(here, '../src/features/plans/fitScript.generated.ts');
fs.writeFileSync(target, out);
console.log('yazıldı:', path.relative(process.cwd(), target));
