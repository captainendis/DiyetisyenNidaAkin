// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

'use client';

/**
 * /panel/tarifler — tarif kütüphanesi (fotoğraflı).
 *  - Planlara ek sayfa olarak eklenir; "Web sitesinde yayınla" işaretlenenler sitede /tarifler altında görünür.
 *  - Varyasyonlar: genel (ör. vegan) ya da kişiye özel. ?danisan=<id> ile bir danışanın tarifleri, ?ana=<id> ile
 *    bir tarif ve varyasyonları süzülür.
 */
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from '@/lib/router';
import { CookingPot, ExternalLink, Plus, Search, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import { RequirePermission, usePanelAuth } from '@/components/panel/PanelAuth';
import { Button, Card, EmptyState, ErrorState, PageHeader, Skeleton, Tabs } from '@/components/panel/ui';
import { RecipeFormModal } from '@/components/panel/recipes/RecipeFormModal';
import { CategoryChips, RecipeCard } from '@/components/panel/recipes/RecipeCard';
import { HomeFeaturedBox } from '@/components/panel/recipes/HomeFeaturedBox';
import { RECIPE_CATEGORIES, type Recipe, type RecipeCategory } from '@shared/recipe';

const norm = (s: string) => s.toLocaleLowerCase('tr-TR');
type Scope = 'tumu' | 'genel' | 'yayinda' | 'kisiye-ozel';

function Body() {
  const [params, setParams] = useSearchParams();
  const category = (RECIPE_CATEGORIES as readonly string[]).includes(params.get('kategori') ?? '') ? (params.get('kategori') as RecipeCategory) : '';
  const scope = (['tumu', 'genel', 'yayinda', 'kisiye-ozel'] as const).find((s) => s === params.get('kapsam')) ?? 'tumu';
  const clientFilter = params.get('danisan');
  const parentFilter = params.get('ana');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Recipe | null>(null);
  const [open, setOpen] = useState(false);
  const { can } = usePanelAuth();
  const editable = can('clinical:write');
  const { data, loading, error, reload } = useApi(() => api.get<{ items: Recipe[] }>('/recipes'), []);

  const setParam = (k: string, v: string | null) =>
    setParams((p) => {
      const n = new URLSearchParams(p);
      if (v) n.set(k, v); else n.delete(k);
      return n;
    }, { replace: true });

  const all = data?.items ?? [];
  const inScope = (r: Recipe) =>
    (scope === 'tumu' || (scope === 'genel' && !r.clientId) || (scope === 'yayinda' && r.isPublished) || (scope === 'kisiye-ozel' && !!r.clientId)) &&
    (!clientFilter || r.clientId === clientFilter) &&
    (!parentFilter || r.id === parentFilter || r.parentId === parentFilter);
  const scoped = all.filter(inScope);
  const counts = useMemo(() => {
    const c: Partial<Record<RecipeCategory | '', number>> = { '': scoped.length };
    for (const r of scoped) c[r.category] = (c[r.category] ?? 0) + 1;
    return c;
  }, [scoped]);
  const items = scoped.filter((r) => (!category || r.category === category) && (!q.trim() || norm(`${r.title} ${r.summary} ${r.variantNote} ${r.ingredients.join(' ')} ${r.client ? `${r.client.firstName} ${r.client.lastName}` : ''}`).includes(norm(q.trim()))));
  const filterClient = clientFilter ? all.find((r) => r.clientId === clientFilter)?.client : null;
  const filterParent = parentFilter ? all.find((r) => r.id === parentFilter) : null;
  const publishedCount = all.filter((r) => r.isPublished).length;

  const openNew = () => { setEditing(null); setOpen(true); };

  return (
    <>
      <PageHeader
        title="Tarifler"
        description="Fotoğraflı tarif kütüphaneniz. Planlara ek sayfa olarak eklenir; seçtikleriniz web sitesinde yayınlanır, kişiye özel varyasyonlar yalnızca o danışanda kalır."
        actions={
          <div className="flex flex-wrap gap-2 sm:flex-nowrap">
            {publishedCount > 0 && (
              <a
                href="/tarifler"
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg bg-white px-4 text-sm font-semibold whitespace-nowrap text-cocoa ring-1 ring-panel-line ring-inset hover:bg-panel-bg"
              >
                <ExternalLink className="h-4 w-4" /> Sitede gör ({publishedCount})
              </a>
            )}
            {editable && <Button icon={<Plus className="h-4 w-4" />} onClick={openNew}>Yeni tarif</Button>}
          </div>
        }
      />
      {data && !clientFilter && !parentFilter && <HomeFeaturedBox library={all} editable={editable} onChanged={() => void reload()} />}
      <Card className="p-4 sm:p-5">
        <Tabs<Scope>
          className="mb-4"
          value={scope}
          onChange={(v) => setParam('kapsam', v === 'tumu' ? null : v)}
          tabs={[
            { value: 'tumu', label: 'Tümü', count: all.length },
            { value: 'genel', label: 'Genel', count: all.filter((r) => !r.clientId).length },
            { value: 'yayinda', label: 'Sitede yayında', count: publishedCount },
            { value: 'kisiye-ozel', label: 'Kişiye özel', count: all.filter((r) => r.clientId).length },
          ]}
        />
        {(filterClient || filterParent || clientFilter || parentFilter) && (
          <div className="mb-4 flex flex-wrap gap-2">
            {clientFilter && (
              <button type="button" onClick={() => setParam('danisan', null)} className="inline-flex items-center gap-1.5 rounded-full bg-cocoa px-3 py-1 text-[0.78rem] font-semibold text-ivory">
                Danışan: {filterClient ? `${filterClient.firstName} ${filterClient.lastName}` : 'seçili'} <X className="h-3.5 w-3.5" />
              </button>
            )}
            {parentFilter && (
              <button type="button" onClick={() => setParam('ana', null)} className="inline-flex items-center gap-1.5 rounded-full bg-cocoa px-3 py-1 text-[0.78rem] font-semibold text-ivory">
                “{filterParent?.title ?? 'Tarif'}” ve varyasyonları <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <CategoryChips value={category} counts={counts} onChange={(c) => setParam('kategori', c || null)} />
          <label className="relative block lg:w-72">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-panel-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tarif, malzeme veya danışan ara" aria-label="Tarif ara" className="h-10 w-full rounded-lg border border-panel-line bg-white pr-3 pl-9 text-sm focus:border-cocoa focus:outline-none" />
          </label>
        </div>
        {loading && !data ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="aspect-[4/5] rounded-xl" />)}
          </div>
        ) : error ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : !items.length ? (
          <EmptyState
            icon={<CookingPot className="h-5 w-5" />}
            title={all.length ? 'Bu süzgeçle eşleşen tarif yok' : 'Henüz tarif yok'}
            description={
              all.length
                ? scope === 'kisiye-ozel'
                  ? 'Bir tarifi açıp “Varyasyon oluştur” ile danışana özel bir versiyon hazırlayabilirsiniz.'
                  : 'Kategoriyi, sekmeyi veya aramayı değiştirin.'
                : 'Danışanlarınıza önerdiğiniz tarifleri fotoğrafıyla ekleyin; planlara ek sayfa olarak koyun.'
            }
            action={editable && !all.length && <Button icon={<Plus className="h-4 w-4" />} onClick={openNew}>İlk tarifi ekle</Button>}
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {items.map((r) => (
              <RecipeCard key={r.id} recipe={r} onClick={() => { setEditing(r); setOpen(true); }} />
            ))}
          </div>
        )}
        {filterClient && (
          <p className="mt-4 text-[0.8rem] text-panel-muted">
            <Link to={`/panel/danisanlar/${clientFilter}?sekme=planlar`} className="font-semibold text-cocoa hover:underline">← {filterClient.firstName} {filterClient.lastName} profiline dön</Link>
          </p>
        )}
      </Card>
      <RecipeFormModal
        open={open}
        onClose={() => setOpen(false)}
        recipe={editing}
        defaultCategory={category || undefined}
        onSaved={() => void reload()}
        onDeleted={editable ? () => void reload() : undefined}
      />
    </>
  );
}

export default function RecipesPage() {
  return (
    <RequirePermission perm="clinical:read">
      <Body />
    </RequirePermission>
  );
}
