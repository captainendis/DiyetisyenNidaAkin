// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * SEO: sayfa meta bilgisi, robots.txt ve sitemap.xml
 *  - resolveMeta(yol) → title/description/canonical/OG/Twitter/JSON-LD; Next.js sayfaları generateMetadata'da
 *    toMetadata() ile kullanır (src/app/seo.ts). /panel ve /hesabim noindex.
 *  - robotsTxt(): /panel, /hesabim ve /api taranmaz
 *  - buildSitemap(): statik sayfalar + yayınlanmış hizmetler, blog yazıları ve tarifler
 * Schema.org verisine YALNIZCA doğrulanmış (panelde girilmiş, null olmayan) bilgiler yazılır.
 */
import type { Metadata } from 'next';
import { prisma } from './lib/db';
import { env } from './lib/env';
import { getSettings } from './services/settings';
import { DEFAULT_BLOG_CATEGORIES } from '../shared/constants';
import { DIET_TAG_SCHEMA, RECIPE_CATEGORY_LABEL, recipeImageUrl } from '../shared/recipe';
import { decryptContent } from './services/recipe-content';

const STATIC_ROUTES: { path: string; priority: string; changefreq: string }[] = [
  { path: '/', priority: '1.0', changefreq: 'weekly' },
  { path: '/hakkimda', priority: '0.8', changefreq: 'monthly' },
  { path: '/hizmetler', priority: '0.9', changefreq: 'monthly' },
  { path: '/beslenme-rehberi', priority: '0.8', changefreq: 'weekly' },
  { path: '/tarifler', priority: '0.8', changefreq: 'weekly' },
  { path: '/iletisim', priority: '0.7', changefreq: 'monthly' },
  { path: '/randevu', priority: '0.7', changefreq: 'monthly' },
  { path: '/kvkk-aydinlatma-metni', priority: '0.2', changefreq: 'yearly' },
  { path: '/acik-riza-metni', priority: '0.2', changefreq: 'yearly' },
  { path: '/gizlilik-politikasi', priority: '0.2', changefreq: 'yearly' },
  { path: '/cerez-politikasi', priority: '0.2', changefreq: 'yearly' },
];

const STATIC_META: Record<string, { title?: string; description?: string }> = {
  '/hakkimda': { title: 'Hakkımda', description: 'Diyetisyen Nida Akın’ın danışmanlık yaklaşımı ve beslenme felsefesi.' },
  '/hizmetler': { title: 'Hizmetler', description: 'Kişiye özel beslenme danışmanlığı, kilo yönetimi, sağlıklı yaşam beslenmesi ve beslenme takibi.' },
  '/beslenme-rehberi': { title: 'Beslenme Rehberi', description: 'Sağlıklı beslenme ve günlük alışkanlıklar üzerine genel bilgilendirme yazıları. İçerikler tıbbi tavsiye yerine geçmez.' },
  '/tarifler': { title: 'Tarifler', description: 'Diyetisyen Nida Akın’ın önerdiği pratik ve dengeli tarifler. Genel öneridir; kişiye özel planın yerine geçmez.' },
  '/iletisim': { title: 'İletişim', description: 'Diyetisyen Nida Akın ile iletişime geçin ya da çevrim içi randevu talebi oluşturun.' },
  '/randevu': { title: 'Randevu Talebi', description: 'Diyetisyen Nida Akın ile görüşmek için çevrim içi randevu talebi oluşturun.' },
  '/kvkk-aydinlatma-metni': { title: 'KVKK Aydınlatma Metni', description: 'Kişisel verilerin işlenmesine ilişkin aydınlatma metni (taslak).' },
  '/acik-riza-metni': { title: 'Açık Rıza Metni', description: 'Randevu formunda isteğe bağlı açık rıza metni (taslak).' },
  '/gizlilik-politikasi': { title: 'Gizlilik Politikası', description: 'Web sitesi gizlilik politikası (taslak).' },
  '/cerez-politikasi': { title: 'Çerez Politikası', description: 'Web sitesinde kullanılan çerezler hakkında bilgilendirme (taslak).' },
};

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
const escapeXml = escapeHtml;

export interface PageMeta {
  title: string;
  description: string;
  canonicalPath: string;
  image?: string | null;
  type?: 'website' | 'article';
  noindex?: boolean;
  jsonLd?: Record<string, unknown>[];
  status?: number;
}

async function businessJsonLd() {
  const { contact, social, business, seo } = await getSettings(['contact', 'social', 'business', 'seo']);
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    name: `${business.brandName} — ${business.title}`,
    url: `${env.publicSiteUrl}/`,
    image: `${env.publicSiteUrl}/og-image.jpg`,
    logo: `${env.publicSiteUrl}/logo.svg`,
    description: seo.defaultDescription,
  };
  if (contact.phone) ld.telephone = contact.phone;
  if (contact.email) ld.email = contact.email;
  if (contact.addressLine && contact.city) {
    ld.address = {
      '@type': 'PostalAddress',
      streetAddress: contact.addressLine,
      addressLocality: contact.district ?? contact.city,
      addressRegion: contact.city,
      ...(contact.postalCode ? { postalCode: contact.postalCode } : {}),
      addressCountry: 'TR',
    };
  }
  if (contact.mapLinkUrl) ld.hasMap = contact.mapLinkUrl;
  const sameAs = Object.values(social).filter(Boolean);
  if (sameAs.length) ld.sameAs = sameAs;
  return ld;
}

function breadcrumb(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [{ name: 'Ana Sayfa', path: '/' }, ...items].map((c, i) => ({
      '@type': 'ListItem', position: i + 1, name: c.name, item: `${env.publicSiteUrl}${c.path}`,
    })),
  };
}

/** Bir yol için meta bilgisi üretir */
export async function resolveMeta(pathname: string): Promise<PageMeta> {
  const clean = pathname.replace(/\/+$/, '') || '/';
  const { seo } = await getSettings(['seo']);
  const t = (title?: string) => (title ? `${title} ${seo.titleSuffix.trim()}` : seo.defaultTitle);

  if (clean.startsWith('/hesabim')) {
    return { title: 'Danışan Hesabım | Nida Akın', description: 'Danışanlar için beslenme listeleri, tarifler ve randevular.', canonicalPath: clean, noindex: true };
  }
  if (clean.startsWith('/panel')) {
    return { title: 'Yönetim Paneli | Nida Akın', description: 'Yetkili kullanıcılar için yönetim paneli.', canonicalPath: clean, noindex: true };
  }
  if (clean === '/') {
    return {
      title: seo.defaultTitle,
      description: seo.defaultDescription,
      canonicalPath: '/',
      jsonLd: [await businessJsonLd(), { '@context': 'https://schema.org', '@type': 'WebSite', name: 'Nida Akın Diyetisyen', url: `${env.publicSiteUrl}/`, inLanguage: 'tr-TR' }],
    };
  }
  if (STATIC_META[clean]) {
    const m = STATIC_META[clean];
    return { title: t(m.title), description: m.description ?? seo.defaultDescription, canonicalPath: clean, jsonLd: [breadcrumb([{ name: m.title!, path: clean }])] };
  }
  let m: RegExpMatchArray | null;
  if ((m = clean.match(/^\/hizmetler\/([a-z0-9-]+)$/))) {
    const s = await prisma.service.findFirst({ where: { slug: m[1], isPublished: true } });
    if (s) {
      return {
        title: t(s.title),
        description: s.summary,
        canonicalPath: clean,
        jsonLd: [
          breadcrumb([{ name: 'Hizmetler', path: '/hizmetler' }, { name: s.title, path: clean }]),
          { '@context': 'https://schema.org', '@type': 'Service', name: s.title, description: s.summary, url: `${env.publicSiteUrl}${clean}` },
        ],
      };
    }
  }
  if ((m = clean.match(/^\/beslenme-rehberi\/kategori\/([a-z0-9-]+)$/))) {
    const c = DEFAULT_BLOG_CATEGORIES.find((x) => x.slug === m![1]) ?? (await prisma.blogCategory.findUnique({ where: { slug: m[1] } }));
    if (c) {
      return {
        title: t(`${c.name} — Beslenme Rehberi`),
        description: STATIC_META['/beslenme-rehberi'].description!,
        canonicalPath: clean,
        jsonLd: [breadcrumb([{ name: 'Beslenme Rehberi', path: '/beslenme-rehberi' }, { name: c.name, path: clean }])],
      };
    }
  }
  if ((m = clean.match(/^\/beslenme-rehberi\/([a-z0-9-]+)$/))) {
    const p = await prisma.blogPost.findFirst({
      where: { slug: m[1], status: 'PUBLISHED' },
      include: { category: true, author: { select: { firstName: true, lastName: true } } },
    });
    if (p) {
      const description = p.metaDescription || p.excerpt;
      const image = p.coverImageUrl ? (p.coverImageUrl.startsWith('http') ? p.coverImageUrl : `${env.publicSiteUrl}${p.coverImageUrl}`) : null;
      return {
        title: t(p.seoTitle || p.title),
        description,
        canonicalPath: clean,
        image,
        type: 'article',
        jsonLd: [
          breadcrumb([
            { name: 'Beslenme Rehberi', path: '/beslenme-rehberi' },
            ...(p.category ? [{ name: p.category.name, path: `/beslenme-rehberi/kategori/${p.category.slug}` }] : []),
            { name: p.title, path: clean },
          ]),
          {
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: p.title,
            description,
            inLanguage: 'tr-TR',
            mainEntityOfPage: `${env.publicSiteUrl}${clean}`,
            ...(p.publishedAt ? { datePublished: p.publishedAt.toISOString() } : {}),
            dateModified: p.updatedAt.toISOString(),
            ...(image ? { image } : {}),
            author: { '@type': 'Person', name: p.author ? `${p.author.firstName} ${p.author.lastName}` : 'Nida Akın' },
            publisher: { '@type': 'Organization', name: 'Nida Akın Diyetisyen', logo: { '@type': 'ImageObject', url: `${env.publicSiteUrl}/logo.svg` } },
          },
        ],
      };
    }
  }
  if ((m = clean.match(/^\/tarifler\/([a-z0-9-]+)$/))) {
    const r = await prisma.recipe.findFirst({ where: { slug: m[1], isPublished: true, clientId: null } });
    if (r) {
      // İçerik şifreli saklanır; yalnızca yayındaki tarif için çözülür
      const { title, summary, ingredients, steps, dietTags } = decryptContent(r.contentEnc);
      const image = r.imageBase ? `${env.publicSiteUrl}${recipeImageUrl(r.imageBase, 960)}` : null;
      const description = summary || `${title} tarifi: ${ingredients.slice(0, 4).join(', ')}.`;
      const iso = (min: number | null) => (min ? `PT${min}M` : undefined);
      const total = (r.prepMinutes ?? 0) + (r.cookMinutes ?? 0);
      return {
        title: t(`${title} tarifi`),
        description,
        canonicalPath: clean,
        image,
        type: 'article',
        jsonLd: [
          breadcrumb([{ name: 'Tarifler', path: '/tarifler' }, { name: title, path: clean }]),
          {
            '@context': 'https://schema.org',
            '@type': 'Recipe',
            name: title,
            description,
            inLanguage: 'tr-TR',
            recipeCategory: RECIPE_CATEGORY_LABEL[r.category],
            recipeCuisine: 'Türk',
            ...(image ? { image: [image] } : {}),
            ...(r.servings ? { recipeYield: `${r.servings} porsiyon` } : {}),
            ...(iso(r.prepMinutes) ? { prepTime: iso(r.prepMinutes) } : {}),
            ...(iso(r.cookMinutes) ? { cookTime: iso(r.cookMinutes) } : {}),
            ...(total ? { totalTime: `PT${total}M` } : {}),
            ...(r.kcal ? { nutrition: { '@type': 'NutritionInformation', calories: `${r.kcal} kcal` } } : {}),
            ...(dietTags.length ? { suitableForDiet: dietTags.map((t) => DIET_TAG_SCHEMA[t]) } : {}),
            recipeIngredient: ingredients,
            recipeInstructions: steps.map((text, i) => ({ '@type': 'HowToStep', position: i + 1, text })),
            ...(r.publishedAt ? { datePublished: r.publishedAt.toISOString() } : {}),
            author: { '@type': 'Person', name: 'Nida Akın' },
          },
        ],
      };
    }
  }
  return { title: t('Sayfa bulunamadı'), description: seo.defaultDescription, canonicalPath: clean, noindex: true, status: 404 };
}

/** PageMeta → Next.js Metadata (JSON-LD ayrıca <JsonLd> ile basılır) */
export function toMetadata(meta: PageMeta): Metadata {
  const url = `${env.publicSiteUrl}${meta.canonicalPath === '/' ? '/' : meta.canonicalPath}`;
  const image = meta.image ?? `${env.publicSiteUrl}/og-image.jpg`;
  return {
    title: { absolute: meta.title },
    description: meta.description,
    robots: meta.noindex ? { index: false, follow: false } : { index: true, follow: true },
    alternates: { canonical: url },
    openGraph: {
      type: meta.type ?? 'website',
      siteName: 'Nida Akın Diyetisyen',
      locale: 'tr_TR',
      title: meta.title,
      description: meta.description,
      url,
      images: [{ url: image, width: 1200, height: 630 }],
    },
    twitter: { card: 'summary_large_image', title: meta.title, description: meta.description, images: [image] },
  };
}

/** JSON-LD bloklarını <script> içine güvenli biçimde yazmak için */
export const serializeJsonLd = (ld: Record<string, unknown>) => JSON.stringify(ld).replace(/</g, '\\u003c');

export async function buildSitemap() {
  const [services, posts, recipes] = await Promise.all([
    prisma.service.findMany({ where: { isPublished: true }, select: { slug: true, updatedAt: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.blogPost.findMany({ where: { status: 'PUBLISHED' }, select: { slug: true, updatedAt: true }, orderBy: { publishedAt: 'desc' } }),
    prisma.recipe.findMany({ where: { isPublished: true, clientId: null, slug: { not: null } }, select: { slug: true, updatedAt: true }, orderBy: { publishedAt: 'desc' } }),
  ]);
  const entries = [
    ...STATIC_ROUTES.map((r) => ({ loc: r.path, priority: r.priority, changefreq: r.changefreq, lastmod: null as Date | null })),
    ...services.map((s) => ({ loc: `/hizmetler/${s.slug}`, priority: '0.7', changefreq: 'monthly', lastmod: s.updatedAt })),
    ...posts.map((p) => ({ loc: `/beslenme-rehberi/${p.slug}`, priority: '0.6', changefreq: 'monthly', lastmod: p.updatedAt })),
    ...recipes.map((r) => ({ loc: `/tarifler/${r.slug}`, priority: '0.6', changefreq: 'monthly', lastmod: r.updatedAt })),
  ];
  const body = entries
    .map(
      (e) =>
        `  <url>\n    <loc>${escapeXml(env.publicSiteUrl + e.loc)}</loc>\n${e.lastmod ? `    <lastmod>${e.lastmod.toISOString().slice(0, 10)}</lastmod>\n` : ''}    <changefreq>${e.changefreq}</changefreq>\n    <priority>${e.priority}</priority>\n  </url>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

export function robotsTxt() {
  return ['User-agent: *', 'Allow: /', 'Disallow: /panel', 'Disallow: /hesabim', 'Disallow: /api/', '', `Sitemap: ${env.publicSiteUrl}/sitemap.xml`, ''].join('\n');
}
