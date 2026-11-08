// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** /panel/tarifler — tarif kütüphanesi (fotoğraflı); tarifler beslenme planlarına ek sayfa olarak eklenir */
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { CookingPot, Plus, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import { RequirePermission, usePanelAuth } from '@/components/panel/PanelAuth';
import { Button, Card, EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/panel/ui';
import { RecipeFormModal } from '@/components/panel/recipes/RecipeFormModal';
import { CategoryChips, RecipeCard } from '@/components/panel/recipes/RecipeCard';
import { RECIPE_CATEGORIES, type Recipe, type RecipeCategory } from '@shared/recipe';

const norm = (s: string) => s.toLocaleLowerCase('tr-TR');

function Body() {
  const [params, setParams] = useSearchParams();
  const category = (RECIPE_CATEGORIES as readonly string[]).includes(params.get('kategori') ?? '') ? (params.get('kategori') as RecipeCategory) : '';
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Recipe | null>(null);
  const [open, setOpen] = useState(false);
  const { can } = usePanelAuth();
  const editable = can('clinical:write');
  const { data, loading, error, reload, setData } = useApi(() => api.get<{ items: Recipe[] }>('/recipes'), []);

  const all = data?.items ?? [];
  const counts = useMemo(() => {
    const c: Partial<Record<RecipeCategory | '', number>> = { '': all.length };
    for (const r of all) c[r.category] = (c[r.category] ?? 0) + 1;
    return c;
  }, [all]);
  const items = all.filter((r) => (!category || r.category === category) && (!q.trim() || norm(`${r.title} ${r.summary} ${r.ingredients.join(' ')}`).includes(norm(q.trim()))));

  const openNew = () => { setEditing(null); setOpen(true); };
  const upsert = (r: Recipe) => setData((d) => ({ items: [r, ...(d?.items ?? []).filter((x) => x.id !== r.id)] }));

  return (
    <>
      <PageHeader
        title="Tarifler"
        description="Fotoğraflı tarif kütüphaneniz. Beslenme planına eklenen tarifler PDF'in arkasına ek sayfa olarak basılır."
        actions={editable && <Button icon={<Plus className="h-4 w-4" />} onClick={openNew}>Yeni tarif</Button>}
      />
      <Card className="p-4 sm:p-5">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <CategoryChips value={category} counts={counts} onChange={(c) => setParams(c ? { kategori: c } : {}, { replace: true })} />
          <label className="relative block lg:w-72">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-panel-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tarif veya malzeme ara" aria-label="Tarif ara" className="h-10 w-full rounded-lg border border-panel-line bg-white pr-3 pl-9 text-sm focus:border-cocoa focus:outline-none" />
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
            description={all.length ? 'Kategoriyi veya aramayı değiştirin.' : 'Danışanlarınıza önerdiğiniz tarifleri fotoğrafıyla ekleyin; planlara tek tıkla ek sayfa olarak koyun.'}
            action={editable && !all.length && <Button icon={<Plus className="h-4 w-4" />} onClick={openNew}>İlk tarifi ekle</Button>}
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {items.map((r) => (
              <RecipeCard key={r.id} recipe={r} onClick={() => { setEditing(r); setOpen(true); }} />
            ))}
          </div>
        )}
      </Card>
      <RecipeFormModal
        open={open}
        onClose={() => setOpen(false)}
        recipe={editing}
        defaultCategory={category || undefined}
        onSaved={upsert}
        onDeleted={editable ? (id) => setData((d) => ({ items: (d?.items ?? []).filter((x) => x.id !== id) })) : undefined}
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
