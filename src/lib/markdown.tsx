/**
 * Güvenli, minimal Markdown → React dönüştürücü (HTML enjeksiyonu yok; dangerouslySetInnerHTML kullanılmaz).
 * Desteklenen: ## / ### başlıklar, paragraflar, - / * listeler, 1. numaralı listeler, > alıntı,
 * **kalın**, *italik*, [bağlantı](https://...) — yalnızca http(s), mailto ve site içi (/) bağlantılar.
 */
import { Fragment, type ReactNode } from 'react';

function safeHref(href: string): string | null {
  const h = href.trim();
  if (h.startsWith('/') && !h.startsWith('//')) return h;
  if (/^(https?:|mailto:)/i.test(h)) return h;
  return null;
}

function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(\[([^\]]+)\]\(([^)\s]+)\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = `${keyBase}-${i++}`;
    if (m[2]) out.push(<strong key={k}>{m[2]}</strong>);
    else if (m[4]) out.push(<em key={k}>{m[4]}</em>);
    else if (m[6]) {
      const href = safeHref(m[7]);
      const external = href && /^https?:/i.test(href);
      out.push(
        href ? (
          <a key={k} href={href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{m[6]}</a>
        ) : (
          <Fragment key={k}>{m[6]}</Fragment>
        ),
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ source, className }: { source: string; className?: string }) {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let para: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let quote: string[] = [];
  let k = 0;

  const flushPara = () => {
    if (para.length) blocks.push(<p key={k++}>{inline(para.join(' '), `p${k}`)}</p>);
    para = [];
  };
  const flushList = () => {
    if (list) {
      const items = list.items.map((it, i) => <li key={i}>{inline(it, `l${k}-${i}`)}</li>);
      blocks.push(list.ordered ? <ol key={k++}>{items}</ol> : <ul key={k++}>{items}</ul>);
    }
    list = null;
  };
  const flushQuote = () => {
    if (quote.length) blocks.push(<blockquote key={k++}>{inline(quote.join(' '), `q${k}`)}</blockquote>);
    quote = [];
  };
  const flushAll = () => {
    flushPara();
    flushList();
    flushQuote();
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flushAll();
      continue;
    }
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^###\s+(.*)/))) {
      flushAll();
      blocks.push(<h3 key={k++}>{inline(m[1], `h${k}`)}</h3>);
    } else if ((m = line.match(/^##?\s+(.*)/))) {
      flushAll();
      blocks.push(<h2 key={k++}>{inline(m[1], `h${k}`)}</h2>);
    } else if ((m = line.match(/^\s*[-*]\s+(.*)/))) {
      flushPara();
      flushQuote();
      if (!list || list.ordered) {
        flushList();
        list = { ordered: false, items: [] };
      }
      list.items.push(m[1]);
    } else if ((m = line.match(/^\s*\d+[.)]\s+(.*)/))) {
      flushPara();
      flushQuote();
      if (!list || !list.ordered) {
        flushList();
        list = { ordered: true, items: [] };
      }
      list.items.push(m[1]);
    } else if ((m = line.match(/^>\s?(.*)/))) {
      flushPara();
      flushList();
      quote.push(m[1]);
    } else {
      flushList();
      flushQuote();
      para.push(line.trim());
    }
  }
  flushAll();
  return <div className={className}>{blocks}</div>;
}

/** Okuma süresi tahmini (dakika) */
export function readingMinutes(source: string) {
  return Math.max(1, Math.round(source.split(/\s+/).filter(Boolean).length / 200));
}
