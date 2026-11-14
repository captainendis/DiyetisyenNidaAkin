// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

'use client';

import { useEffect, useState } from 'react';
import { Link, useParams } from '@/lib/router';
import { api } from '@/lib/api';
import type { PostCard as Post, PostDetail } from '@/data/types';
import { Markdown } from '@/lib/markdown';
import { PageHeader } from '@/components/sections/PageHeader';
import { PostCard } from '@/components/cards/PostCard';
import { CtaBand } from '@/components/sections/CtaBand';
import { Seo, SITE_URL } from '@/components/seo/Seo';
import { formatDateIntl as formatDate } from '@/lib/text';
import NotFoundPage from './NotFoundPage';

export default function BlogPostPage() {
  const { slug } = useParams();
  const [data, setData] = useState<{ post: PostDetail; related: Post[] } | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let alive = true;
    setData(null);
    setMissing(false);
    api
      .get<{ post: PostDetail; related: Post[] }>(`/public/blog/${encodeURIComponent(slug ?? '')}`)
      .then((r) => alive && setData(r))
      .catch(() => alive && setMissing(true));
    return () => {
      alive = false;
    };
  }, [slug]);

  if (missing) return <NotFoundPage />;
  if (!data) return <div className="min-h-dvh bg-espresso" aria-busy="true" />;
  const { post, related } = data;
  const crumbs = [
    { name: 'Beslenme Rehberi', path: '/beslenme-rehberi' },
    ...(post.category ? [{ name: post.category.name, path: `/beslenme-rehberi/kategori/${post.category.slug}` }] : []),
    { name: post.title, path: `/beslenme-rehberi/${post.slug}` },
  ];
  const description = post.metaDescription || post.excerpt;

  return (
    <>
      <Seo
        title={post.seoTitle || post.title}
        description={description}
        type="article"
        image={post.coverImageUrl ?? undefined}
        breadcrumbs={crumbs}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: post.title,
          description,
          inLanguage: 'tr-TR',
          mainEntityOfPage: `${SITE_URL}/beslenme-rehberi/${post.slug}`,
          ...(post.publishedAt ? { datePublished: post.publishedAt } : {}),
          dateModified: post.updatedAt,
          ...(post.coverImageUrl ? { image: post.coverImageUrl.startsWith('http') ? post.coverImageUrl : `${SITE_URL}${post.coverImageUrl}` } : {}),
          author: { '@type': 'Person', name: post.author ? `${post.author.firstName} ${post.author.lastName}` : 'Nida Akın' },
          publisher: { '@type': 'Organization', name: 'Nida Akın Diyetisyen', logo: { '@type': 'ImageObject', url: `${SITE_URL}/logo.svg` } },
        }}
      />
      <PageHeader
        title={post.title}
        crumbs={crumbs.slice(0, -1)}
        eyebrow={post.category?.name}
        lead={
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.85rem] tracking-[0.04em] text-mist">
            {post.publishedAt && <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>}
            {post.readingMinutes && <span>{post.readingMinutes} dk okuma</span>}
          </p>
        }
      />
      <article className="bg-ivory text-espresso">
        <div className="container-edge grid gap-12 py-16 sm:py-24 lg:grid-cols-12 lg:gap-x-10">
          <div className="lg:col-span-7 lg:col-start-3">
            {post.coverImageUrl && (
              <img src={post.coverImageUrl} alt={post.coverImageAlt ?? ''} width={1200} height={800} className="mb-12 aspect-[3/2] w-full object-cover" />
            )}
            {post.excerpt && <p className="font-display text-[1.6rem] leading-snug text-cocoa sm:text-[1.85rem]">{post.excerpt}</p>}
            <Markdown source={post.content} className="prose-editorial mt-8" />
            <aside className="mt-16 border-l-2 border-gold bg-cream/70 px-6 py-5 text-[0.92rem] leading-relaxed text-cocoa/85" role="note">
              <strong className="font-semibold text-espresso">Bilgilendirme: </strong>
              Bu içerik genel bilgilendirme amaçlıdır; tıbbi tavsiye, tanı veya tedavi yerine geçmez. Sağlık durumunuza özel değerlendirme için bir hekime veya diyetisyene danışın.
            </aside>
            <div className="mt-12 border-t border-espresso/12 pt-8">
              <Link to="/beslenme-rehberi" className="text-[0.92rem] text-taupe hover:text-espresso">← Tüm yazılar</Link>
            </div>
          </div>
        </div>
      </article>
      {related.length > 0 && (
        <section className="bg-cream text-espresso" aria-labelledby="related-title">
          <div className="container-edge py-20 sm:py-28">
            <h2 id="related-title" className="font-display text-[2.2rem] font-medium">Benzer yazılar</h2>
            <div className="mt-12 grid gap-x-10 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((p) => <PostCard key={p.id} post={p} />)}
            </div>
          </div>
        </section>
      )}
      <CtaBand />
    </>
  );
}
