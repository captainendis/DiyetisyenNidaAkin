// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Güvenli, minimal Markdown → React Native (web: src/lib/markdown.tsx ile aynı dil bilgisi).
 * Desteklenen: ## / ### başlıklar, paragraflar, - / * listeler, 1. listeler, > alıntı, **kalın**, *italik*,
 * [bağlantı](https://...) — yalnızca http(s), mailto ve site içi (/) bağlantılar.
 */
import * as WebBrowser from 'expo-web-browser';
import { Linking, View } from 'react-native';
import type { ReactNode } from 'react';
import { colors, fonts, space } from '@/theme';
import { SITE_URL } from '@/lib/config';
import { T } from './Text';

function safeHref(href: string): string | null {
  const h = href.trim();
  if (h.startsWith('/') && !h.startsWith('//')) return SITE_URL + h;
  if (/^(https?:|mailto:)/i.test(h)) return h;
  return null;
}

function open(href: string) {
  if (/^mailto:/i.test(href)) void Linking.openURL(href);
  else void WebBrowser.openBrowserAsync(href);
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
    if (m[2]) out.push(<T key={k} weight="bold">{m[2]}</T>);
    else if (m[4]) out.push(<T key={k} style={{ fontStyle: 'italic' }}>{m[4]}</T>);
    else if (m[6]) {
      const href = safeHref(m[7]!);
      out.push(
        href ? (
          <T key={k} color={colors.roseInk} style={{ textDecorationLine: 'underline' }} onPress={() => open(href)} accessibilityRole="link">{m[6]}</T>
        ) : (
          m[6]
        ),
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ source }: { source: string }) {
  const lines = (source ?? '').replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let para: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let quote: string[] = [];
  let k = 0;

  const flushPara = () => {
    if (para.length) blocks.push(<T key={k++}>{inline(para.join(' '), `p${k}`)}</T>);
    para = [];
  };
  const flushList = () => {
    if (list) {
      const l = list;
      blocks.push(
        <View key={k++} style={{ gap: 6 }}>
          {l.items.map((it, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 8 }}>
              <T color={colors.goldInk} style={{ minWidth: 16 }}>{l.ordered ? `${i + 1}.` : '•'}</T>
              <T style={{ flex: 1 }}>{inline(it, `l${k}-${i}`)}</T>
            </View>
          ))}
        </View>,
      );
    }
    list = null;
  };
  const flushQuote = () => {
    if (quote.length)
      blocks.push(
        <View key={k++} style={{ borderLeftWidth: 2, borderLeftColor: colors.gold, paddingLeft: space.md }}>
          <T style={{ fontFamily: fonts.displayItalic, fontSize: 18, lineHeight: 24 }}>{inline(quote.join(' '), `q${k}`)}</T>
        </View>,
      );
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
      blocks.push(<T key={k++} variant="heading" style={{ marginTop: 4 }}>{inline(m[1]!, `h${k}`)}</T>);
    } else if ((m = line.match(/^##?\s+(.*)/))) {
      flushAll();
      blocks.push(<T key={k++} variant="title" style={{ marginTop: 6 }}>{inline(m[1]!, `h${k}`)}</T>);
    } else if ((m = line.match(/^\s*[-*]\s+(.*)/))) {
      flushPara();
      flushQuote();
      if (!list || list.ordered) {
        flushList();
        list = { ordered: false, items: [] };
      }
      list.items.push(m[1]!);
    } else if ((m = line.match(/^\s*\d+[.)]\s+(.*)/))) {
      flushPara();
      flushQuote();
      if (!list || !list.ordered) {
        flushList();
        list = { ordered: true, items: [] };
      }
      list.items.push(m[1]!);
    } else if ((m = line.match(/^>\s?(.*)/))) {
      flushPara();
      flushList();
      quote.push(m[1]!);
    } else {
      flushList();
      flushQuote();
      para.push(line.trim());
    }
  }
  flushAll();
  return <View style={{ gap: space.md }}>{blocks}</View>;
}
