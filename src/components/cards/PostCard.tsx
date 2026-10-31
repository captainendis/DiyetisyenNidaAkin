import { Link } from 'react-router';
import type { PostCard as Post } from '@/data/types';
import { formatDate } from '@/lib/format';
import { Sprig } from '@/components/icons/Botanical';
import { cn } from '@/lib/format';

/** Kapak görseli yoksa: tipografik, sıcak tonlu kapak (stok görsel kullanılmaz) */
function Cover({ post, large }: { post: Post; large?: boolean }) {
  if (post.coverImageUrl) {
    return (
      <img
        src={post.coverImageUrl}
        alt={post.coverImageAlt ?? ''}
        loading="lazy"
        width={1200}
        height={800}
        className="aspect-[3/2] w-full object-cover transition-transform duration-[1.2s] ease-[var(--ease-soft)] group-hover:scale-[1.03]"
      />
    );
  }
  return (
    <div className={cn('relative flex aspect-[3/2] w-full items-end overflow-hidden bg-[linear-gradient(150deg,#3b2b20_0%,#302219_60%,#211710_100%)] p-6', large && 'lg:aspect-[16/10]')} aria-hidden>
      <Sprig className="absolute top-6 right-6 w-24 text-gold/40 transition-transform duration-700 group-hover:-rotate-6" />
      <span className="font-display text-[1.05rem] text-rose/80 italic">{post.category?.name ?? 'Beslenme Rehberi'}</span>
    </div>
  );
}

export function PostCard({ post, large = false }: { post: Post; large?: boolean }) {
  return (
    <article className="group">
      <Link to={`/beslenme-rehberi/${post.slug}`} className="block">
        <div className="overflow-hidden"><Cover post={post} large={large} /></div>
        <div className="mt-5 flex items-center gap-3 text-[0.72rem] font-semibold tracking-[0.16em] text-taupe uppercase">
          {post.category && <span>{post.category.name}</span>}
          {post.publishedAt && <><span aria-hidden className="h-px w-5 bg-gold/60" /><time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time></>}
        </div>
        <h3 className={cn('mt-3 font-display leading-[1.12] font-medium text-espresso transition-colors group-hover:text-cocoa', large ? 'text-[clamp(1.9rem,1.4rem+1.6vw,2.8rem)]' : 'text-[1.6rem]')}>{post.title}</h3>
        {post.excerpt && <p className={cn('mt-3 leading-relaxed text-cocoa/75', large ? 'max-w-xl text-[1.02rem]' : 'text-[0.95rem]')}>{post.excerpt}</p>}
        {post.readingMinutes && <p className="mt-4 text-[0.8rem] text-taupe">{post.readingMinutes} dk okuma</p>}
      </Link>
    </article>
  );
}
