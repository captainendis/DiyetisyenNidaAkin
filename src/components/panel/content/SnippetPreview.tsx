// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Google arama sonucu önizlemesi (yaklaşık) */
export function SnippetPreview({ title, description, path }: { title: string; description: string; path: string }) {
  const host = typeof window !== 'undefined' ? window.location.host : 'alanadi.com';
  const t = title.length > 62 ? `${title.slice(0, 60)}…` : title;
  const desc = description.length > 160 ? `${description.slice(0, 158)}…` : description;
  return (
    <div className="rounded-lg border border-panel-line bg-white p-4" aria-label="Arama sonucu önizlemesi">
      <p className="mb-2 text-[0.68rem] font-semibold tracking-[0.12em] text-panel-muted uppercase">Arama sonucu önizlemesi</p>
      <p className="truncate text-[0.78rem] text-[#4d5156]">
        {host}
        {path !== '/' && <span> › {path.replace(/^\//, '').split('/').join(' › ')}</span>}
      </p>
      <p className="mt-0.5 truncate text-[1.12rem] leading-snug text-[#1a0dab]">{t || 'Başlık'}</p>
      <p className="mt-1 line-clamp-2 text-[0.82rem] leading-relaxed text-[#4d5156]">{desc || 'Açıklama girilmedi; arama motoru sayfadan bir metin seçecektir.'}</p>
    </div>
  );
}
