// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import { useEffect } from 'react';
import { Link } from 'react-router';
import { portalApi } from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import { RECIPE_CATEGORY_LABEL } from '@shared/recipe';
import type { PortalRecipeCard } from '@shared/portal';
import { RecipeImage } from '@/components/cards/RecipeCard';
import { Empty, LoadError, Loading, PortalPageHeader } from '@/components/portal/ui';

export default function PortalRecipesPage() {
  const { data, error, loading, reload } = useApi(() => portalApi.get<{ items: PortalRecipeCard[] }>('/recipes'), []);
  useEffect(() => {
    document.title = 'Tariflerim | Nida Akın';
  }, []);

  return (
    <>
      <PortalPageHeader
        title="Tarifler"
        lead={<>Listelerine eklenen ve sana özel hazırlanan tarifler. Herkese açık tarifler için <Link to="/tarifler" className="font-semibold text-espresso underline underline-offset-4">tarifler sayfasına</Link> bakabilirsin.</>}
      />
      {loading && !data ? (
        <Loading />
      ) : error ? (
        <LoadError message={error.message} onRetry={reload} />
      ) : !data?.items.length ? (
        <Empty title="Henüz sana eklenmiş tarif yok.">Diyetisyenin listene tarif eklediğinde burada görünecek.</Empty>
      ) : (
        <ul className="grid gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
          {data.items.map((r) => (
            <li key={r.id}>
              <Link to={`/hesabim/tarifler/${r.id}`} className="group block">
                <div className="overflow-hidden rounded-2xl"><RecipeImage recipe={r} className="transition-transform duration-500 group-hover:scale-[1.02]" /></div>
                <p className="mt-4 flex flex-wrap items-center gap-2 text-[0.8rem] font-semibold tracking-wide text-taupe uppercase">
                  {RECIPE_CATEGORY_LABEL[r.category]}
                  {r.personal && <span className="rounded-full bg-espresso px-2 py-0.5 text-[0.72rem] tracking-normal text-ivory normal-case">Sana özel</span>}
                </p>
                <h2 className="mt-1 font-display text-[1.55rem] leading-tight font-medium group-hover:underline group-hover:underline-offset-4">{r.title}</h2>
                {r.variantNote && <p className="mt-1 text-[0.92rem] font-semibold text-rose-ink">{r.variantNote}</p>}
                {r.inPlans.length > 0 && <p className="mt-1 text-[0.85rem] text-taupe">{r.inPlans.join(', ')}</p>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
