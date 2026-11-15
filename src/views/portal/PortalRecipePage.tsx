// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

'use client';

import { useEffect } from 'react';
import { useParams } from '@/lib/router';
import { portalApi } from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import { RECIPE_CATEGORY_LABEL } from '@shared/recipe';
import type { PortalRecipe } from '@shared/portal';
import { RecipeImage } from '@/components/cards/RecipeCard';
import { DietNotes } from '@/components/recipes/DietBadges';
import { Empty, LoadError, Loading, Panel, PanelTitle, PortalPageHeader } from '@/components/portal/ui';

export default function PortalRecipePage() {
  const { id = '' } = useParams();
  const { data, error, loading, reload } = useApi(() => portalApi.get<{ recipe: PortalRecipe }>(`/recipes/${id}`), [id]);
  const r = data?.recipe;
  useEffect(() => {
    if (r) document.title = `${r.title} | Nida Akın`;
  }, [r]);

  const back = { to: '/hesabim/tarifler', label: 'Tarifler' };
  if (loading && !data) return <Loading rows={4} />;
  if (error?.status === 404) return <><PortalPageHeader title="Tarif bulunamadı" back={back} /><Empty title="Bu tarif artık listende yok." /></>;
  if (error || !r) return <LoadError message={error?.message} onRetry={reload} />;

  const facts = [
    r.servings ? ['Porsiyon', String(r.servings)] : null,
    r.prepMinutes ? ['Hazırlık', `${r.prepMinutes} dk`] : null,
    r.cookMinutes ? ['Pişirme', `${r.cookMinutes} dk`] : null,
    r.kcal ? ['Porsiyonu', `~${r.kcal} kcal`] : null,
  ].filter((x): x is string[] => !!x);

  return (
    <>
      <PortalPageHeader
        back={back}
        title={r.title}
        lead={
          <>
            <span className="block text-[0.9rem] font-semibold text-taupe">{RECIPE_CATEGORY_LABEL[r.category]}{r.personal ? ' · sana özel' : ''}</span>
            {r.variantNote && <span className="mt-2 block font-semibold text-rose-ink">{r.variantNote}</span>}
            {r.summary && <span className="mt-2 block">{r.summary}</span>}
          </>
        }
      />
      <div className={r.imageBase ? 'grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]' : undefined}>
        {r.imageBase && <div className="overflow-hidden rounded-lg"><RecipeImage recipe={r} eager /></div>}
        {facts.length > 0 && (
          <dl className={r.imageBase ? 'grid h-fit grid-cols-2 gap-3 self-end' : 'grid grid-cols-2 gap-3 sm:grid-cols-4'}>
            {facts.map(([k, v]) => (
              <div key={k} className="rounded-md bg-white px-4 py-3 ring-1 ring-espresso/[0.07]">
                <dt className="text-[0.85rem] font-semibold text-taupe">{k}</dt>
                <dd className="mt-1 font-display nums text-[1.6rem] leading-none">{v}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      <DietNotes tags={r.dietTags} className="mt-6" />
      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <Panel>
          <PanelTitle>Malzemeler</PanelTitle>
          <ul className="divide-y divide-espresso/10">
            {r.ingredients.map((i, k) => <li key={k} className="py-2.5 text-[1rem] leading-relaxed">{i}</li>)}
          </ul>
        </Panel>
        <Panel>
          <PanelTitle>Hazırlanışı</PanelTitle>
          <ol className="space-y-4">
            {r.steps.map((s, k) => (
              <li key={k} className="flex gap-4">
                <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-full ring-1 ring-espresso/30 font-display nums text-[1.05rem]">{k + 1}</span>
                <p className="pt-1 text-[1rem] leading-relaxed text-cocoa">{s}</p>
              </li>
            ))}
          </ol>
          {r.tip && <p className="mt-6 rounded-xl bg-cream/70 px-4 py-3 text-[0.95rem] leading-relaxed"><strong className="font-semibold">İpucu. </strong>{r.tip}</p>}
        </Panel>
      </div>
    </>
  );
}
