// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Ana sayfadaki "Mutfaktan" şeridinde hangi tariflerin görüneceğini seçme kutusu.
 * Yalnızca yayındaki, kişiye özel olmayan tarifler seçilebilir; en fazla MAX_FEATURED_RECIPES.
 * Hiç seçim yoksa sitede son yayınlanan tarifler gösterilir.
 */
import { useState } from 'react';
import { ExternalLink, House, X } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Card, Select, useFeedback } from '@/components/panel/ui';
import { RecipeThumb } from './RecipeCard';
import { MAX_FEATURED_RECIPES, RECIPE_CATEGORY_LABEL, type Recipe } from '@shared/recipe';

export function HomeFeaturedBox({ library, editable, onChanged }: { library: Recipe[]; editable: boolean; onChanged: () => void }) {
  const fb = useFeedback();
  const [busy, setBusy] = useState<string | null>(null);
  const published = library.filter((r) => r.isPublished && !r.clientId);
  // Sitedeki sırayla aynı: seçilme zamanına göre
  const featured = published.filter((r) => r.isFeatured).sort((a, b) => (a.featuredAt ?? '').localeCompare(b.featuredAt ?? ''));
  const candidates = published.filter((r) => !r.isFeatured);
  // Seçim yoksa sitede görünecek olanlar: son yayınlananlar
  const fallback = [...published].sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? '')).slice(0, MAX_FEATURED_RECIPES);

  const toggle = async (r: Recipe, featured: boolean) => {
    setBusy(r.id);
    try {
      await api.put(`/recipes/${r.id}/featured`, { featured });
      onChanged();
    } catch (e) {
      fb.error('Değiştirilemedi', e instanceof ApiError ? Object.values(e.fields)[0] ?? e.message : undefined);
    } finally {
      setBusy(null);
    }
  };

  if (!published.length) return null;
  const shown = featured.length ? featured : fallback;

  return (
    <Card className="mb-5 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-[0.95rem] font-bold text-espresso">
            <House className="h-4 w-4 text-cocoa" /> Ana sayfada gösterilenler
            <span className="tabular rounded-full bg-panel-bg px-2 py-0.5 text-[0.72rem] font-semibold text-panel-muted">{featured.length}/{MAX_FEATURED_RECIPES}</span>
          </h2>
          <p className="mt-0.5 text-[0.8rem] text-panel-muted">
            {featured.length
              ? '“Mutfaktan” bölümünde bu sırayla görünür.'
              : 'Henüz seçim yok — ana sayfada şu an son yayınlanan tarifler görünüyor. Seçtiğiniz anda yalnızca sizin seçtikleriniz görünür.'}
          </p>
        </div>
        <a href="/#recipes-title" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[0.8rem] font-semibold text-cocoa hover:underline">
          Ana sayfada gör <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
      <ul className="mt-4 grid gap-2 sm:grid-cols-3">
        {shown.map((r, i) => (
          <li key={r.id} className={`flex items-center gap-3 rounded-lg border p-2 ${featured.length ? 'border-panel-line' : 'border-dashed border-panel-line opacity-70'}`}>
            <span className="tabular w-4 shrink-0 text-center text-[0.8rem] font-bold text-panel-muted">{i + 1}</span>
            <RecipeThumb recipe={r} className="h-11 w-14 shrink-0 rounded-md" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.85rem] font-bold text-espresso">{r.title}</p>
              <p className="truncate text-[0.72rem] text-panel-muted">{featured.length ? RECIPE_CATEGORY_LABEL[r.category] : 'Otomatik (son yayınlanan)'}</p>
            </div>
            {featured.length > 0 && editable && (
              <button type="button" aria-label={`${r.title} ana sayfadan çıkar`} disabled={busy === r.id} onClick={() => void toggle(r, false)} className="rounded p-1 text-panel-muted hover:bg-panel-bg hover:text-danger disabled:opacity-40">
                <X className="h-4 w-4" />
              </button>
            )}
          </li>
        ))}
      </ul>
      {editable && featured.length < MAX_FEATURED_RECIPES && candidates.length > 0 && (
        <div className="mt-3 sm:max-w-sm">
          <Select
            aria-label="Ana sayfaya tarif ekle"
            value=""
            placeholder="+ Ana sayfaya tarif ekle"
            disabled={!!busy}
            options={candidates.map((r) => ({ value: r.id, label: r.variantNote ? `${r.title} · ${r.variantNote}` : r.title }))}
            onChange={(e) => {
              const r = candidates.find((x) => x.id === e.target.value);
              if (r) void toggle(r, true);
            }}
          />
        </div>
      )}
    </Card>
  );
}
