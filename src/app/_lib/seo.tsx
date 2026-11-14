// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Sunucu tarafı SEO yardımcıları — sayfa meta bilgisi (generateMetadata) ve JSON-LD */
import 'server-only';
import { cache } from 'react';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { resolveMeta, serializeJsonLd, toMetadata, type PageMeta } from '../../../server/seo';

/** Aynı istekte generateMetadata ve sayfa aynı sonucu paylaşır */
const getMeta = cache(async (path: string): Promise<PageMeta> => {
  try {
    return await resolveMeta(path);
  } catch (e) {
    console.error('SEO meta üretilemedi', e);
    return { title: 'Nida Akın — Diyetisyen', description: '', canonicalPath: path };
  }
});

export async function pageMetadata(path: string) {
  return toMetadata(await getMeta(path));
}

/** Sayfanın JSON-LD blokları; yol bilinmiyorsa (yayında olmayan yazı/tarif/hizmet) 404 */
export async function SeoJsonLd({ path }: { path: string }) {
  const meta = await getMeta(path);
  if (meta.status === 404) notFound();
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  return (
    <>
      {(meta.jsonLd ?? []).map((ld, i) => (
        // data-seo-ld: istemcideki <Seo> bileşeni gezintide bu blokları günceller
        <script key={i} type="application/ld+json" data-seo-ld="" nonce={nonce} dangerouslySetInnerHTML={{ __html: serializeJsonLd(ld) }} />
      ))}
    </>
  );
}
