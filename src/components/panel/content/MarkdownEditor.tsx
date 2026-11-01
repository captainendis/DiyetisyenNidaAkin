// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Basit Markdown düzenleyici: araç çubuğu + yazma / önizleme / yan yana görünümler */
import { useRef, useState } from 'react';
import { Bold, Eye, Heading2, Italic, Link2, List, ListOrdered, PenLine, Columns2 } from 'lucide-react';
import { Markdown } from '@/lib/markdown';
import { cn } from '@/lib/format';

type View = 'write' | 'split' | 'preview';

export function MarkdownEditor({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [view, setView] = useState<View>('write');

  /** Seçimi sarmalar veya satır başına önek ekler */
  const apply = (kind: 'h2' | 'bold' | 'italic' | 'ul' | 'ol' | 'link') => {
    const ta = ref.current;
    if (!ta) return;
    const { selectionStart: s, selectionEnd: e } = ta;
    const sel = value.slice(s, e);
    let insert = '';
    let cursor: [number, number] = [s, e];
    const lineStart = value.lastIndexOf('\n', s - 1) + 1;
    if (kind === 'bold' || kind === 'italic') {
      const mark = kind === 'bold' ? '**' : '*';
      const text = sel || (kind === 'bold' ? 'kalın metin' : 'italik metin');
      insert = `${mark}${text}${mark}`;
      const next = value.slice(0, s) + insert + value.slice(e);
      onChange(next);
      cursor = [s + mark.length, s + mark.length + text.length];
    } else if (kind === 'link') {
      const text = sel || 'bağlantı metni';
      insert = `[${text}](https://)`;
      onChange(value.slice(0, s) + insert + value.slice(e));
      cursor = [s + text.length + 3, s + text.length + 11];
    } else {
      const prefix = kind === 'h2' ? '## ' : kind === 'ul' ? '- ' : '1. ';
      const block = value.slice(lineStart, e || lineStart);
      const lines = (block || '').split('\n').map((l, i) => (kind === 'ol' ? `${i + 1}. ` : prefix) + l.replace(/^(#{1,3}\s|[-*]\s|\d+\.\s)/, ''));
      const replaced = lines.join('\n');
      onChange(value.slice(0, lineStart) + replaced + value.slice(Math.max(e, lineStart)));
      cursor = [lineStart + replaced.length, lineStart + replaced.length];
    }
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(...cursor);
    });
  };

  const tools = [
    { k: 'h2' as const, label: 'Ara başlık', icon: Heading2 },
    { k: 'bold' as const, label: 'Kalın', icon: Bold },
    { k: 'italic' as const, label: 'İtalik', icon: Italic },
    { k: 'ul' as const, label: 'Madde listesi', icon: List },
    { k: 'ol' as const, label: 'Numaralı liste', icon: ListOrdered },
    { k: 'link' as const, label: 'Bağlantı', icon: Link2 },
  ];
  const views = [
    { v: 'write' as const, label: 'Yaz', icon: PenLine },
    { v: 'split' as const, label: 'Yan yana', icon: Columns2 },
    { v: 'preview' as const, label: 'Önizleme', icon: Eye },
  ];

  return (
    <div className={cn('overflow-hidden rounded-lg border bg-white', error ? 'border-danger' : 'border-panel-line')}>
      <div className="flex flex-wrap items-center gap-1 border-b border-panel-line bg-panel-bg/60 px-2 py-1.5">
        {view !== 'preview' &&
          tools.map((t) => (
            <button key={t.k} type="button" title={t.label} aria-label={t.label} onClick={() => apply(t.k)} className="rounded-md p-1.5 text-cocoa/75 hover:bg-white hover:text-espresso">
              <t.icon className="h-4 w-4" />
            </button>
          ))}
        <div className="ml-auto flex rounded-md bg-white p-0.5 ring-1 ring-panel-line" role="group" aria-label="Görünüm">
          {views.map((v) => (
            <button
              key={v.v}
              type="button"
              aria-pressed={view === v.v}
              onClick={() => setView(v.v)}
              className={cn('flex items-center gap-1.5 rounded px-2 py-1 text-[0.75rem] font-semibold', view === v.v ? 'bg-cocoa text-ivory' : 'text-cocoa/70 hover:text-espresso', v.v === 'split' && 'hidden lg:flex')}
            >
              <v.icon className="h-3.5 w-3.5" /> {v.label}
            </button>
          ))}
        </div>
      </div>
      <div className={cn('grid', view === 'split' && 'lg:grid-cols-2')}>
        {view !== 'preview' && (
          <textarea
            ref={ref}
            aria-label="Yazı içeriği"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={22}
            placeholder={'Yazınızı buraya yazın.\n\n## Ara başlık\nParagraflar arasında bir boş satır bırakın.\n\n- Madde listesi'}
            className="min-h-[28rem] w-full resize-y border-0 px-4 py-3.5 font-mono text-[0.86rem] leading-relaxed text-espresso focus:ring-0 focus:outline-none"
          />
        )}
        {view !== 'write' && (
          <div className={cn('max-h-[44rem] min-h-[28rem] overflow-y-auto bg-ivory px-6 py-5', view === 'split' && 'border-t border-panel-line lg:border-t-0 lg:border-l')}>
            {value.trim() ? <Markdown source={value} className="prose-editorial" /> : <p className="text-sm text-panel-muted">Önizlenecek içerik yok.</p>}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between border-t border-panel-line px-4 py-2 text-[0.75rem] text-panel-muted">
        <span>{error ? <span className="text-danger">{error}</span> : 'Biçimlendirme: ## başlık · **kalın** · *italik* · - liste · [metin](https://…)'}</span>
        <span className="tabular">{value.split(/\s+/).filter(Boolean).length} kelime</span>
      </div>
    </div>
  );
}
