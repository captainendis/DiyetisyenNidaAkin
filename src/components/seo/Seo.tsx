// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Sayfa başına SEO: title, description, canonical, Open Graph, Twitter Card, robots ve JSON-LD.
 * Sunucu aynı etiketleri ilk HTML'e yazar (app/ → generateMetadata, server/seo.ts); bu bileşen istemci gezintisinde günceller.
 */
'use client';

import { useEffect } from 'react';
import { useLocation } from '@/lib/router';
import { useSite } from '@/data/SiteContext';

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');

function setMeta(attr: 'name' | 'property', key: string, content: string | null) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (content === null) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
}

export interface Crumb { name: string; path: string }

export function Seo({
  title, description, image = '/og-image.jpg', type = 'website', noindex = false, jsonLd, breadcrumbs,
}: {
  title?: string;
  description?: string;
  image?: string;
  type?: 'website' | 'article';
  noindex?: boolean;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  breadcrumbs?: Crumb[];
}) {
  const { site } = useSite();
  const { pathname } = useLocation();
  const seo = site.settings.seo;
  const fullTitle = title ? `${title} ${seo.titleSuffix.trim()}` : seo.defaultTitle;
  const desc = description ?? seo.defaultDescription;
  const url = `${SITE_URL}${pathname === '/' ? '/' : pathname.replace(/\/$/, '')}`;
  const img = image.startsWith('http') ? image : `${SITE_URL}${image}`;
  const ldKey = JSON.stringify([jsonLd, breadcrumbs]);

  useEffect(() => {
    document.title = fullTitle;
    setMeta('name', 'description', desc);
    setMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow');
    setLink('canonical', url);
    setMeta('property', 'og:type', type);
    setMeta('property', 'og:site_name', 'Nida Akın Diyetisyen');
    setMeta('property', 'og:locale', 'tr_TR');
    setMeta('property', 'og:title', fullTitle);
    setMeta('property', 'og:description', desc);
    setMeta('property', 'og:url', url);
    setMeta('property', 'og:image', img);
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', fullTitle);
    setMeta('name', 'twitter:description', desc);
    setMeta('name', 'twitter:image', img);

    document.head.querySelectorAll('script[data-seo-ld]').forEach((s) => s.remove());
    const blocks: Record<string, unknown>[] = [];
    if (jsonLd) blocks.push(...(Array.isArray(jsonLd) ? jsonLd : [jsonLd]));
    if (breadcrumbs?.length) {
      blocks.push({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [{ name: 'Ana Sayfa', path: '/' }, ...breadcrumbs].map((c, i) => ({
          '@type': 'ListItem', position: i + 1, name: c.name, item: `${SITE_URL}${c.path}`,
        })),
      });
    }
    for (const b of blocks) {
      const s = document.createElement('script');
      s.type = 'application/ld+json';
      s.dataset.seoLd = '';
      s.textContent = JSON.stringify(b).replace(/</g, '\\u003c');
      document.head.appendChild(s);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullTitle, desc, url, img, type, noindex, ldKey]);

  return null;
}

/** Yalnızca doğrulanmış (null olmayan) alanlarla ProfessionalService şeması */
export function useBusinessJsonLd() {
  const { site } = useSite();
  const { contact, social, business, seo } = site.settings;
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    name: `${business.brandName} — ${business.title}`,
    url: `${SITE_URL}/`,
    image: `${SITE_URL}/og-image.jpg`,
    logo: `${SITE_URL}/logo.svg`,
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
