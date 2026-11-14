// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Danışan detayı → Beslenme Planları sekmesi */
import { useState } from 'react';
import { Link } from 'react-router';
import { CookingPot, Printer, FileText, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import { Button, Card, EmptyState, ErrorState, SkeletonRows } from '@/components/panel/ui';
import { formatDateTime } from '@/lib/format';
import { openPlanPrint, type PlanListItem } from './api';
import { NewPlanModal } from './NewPlanModal';
import { RecipeThumb } from '@/components/panel/recipes/RecipeCard';
import { RECIPE_CATEGORY_LABEL, type Recipe } from '@shared/recipe';

/** Danışana özel tarif varyasyonları (yalnızca listeleme; düzenleme Tarifler sayfasında) */
function ClientRecipes({ clientId }: { clientId: string }) {
  const { data } = useApi(() => api.get<{ items: Recipe[] }>('/recipes', { clientId }), [clientId]);
  return (
    <Card className="mt-5">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-4">
        <div>
          <h2 className="text-[0.95rem] font-bold text-espresso">Kişiye özel tarifler</h2>
          <p className="mt-0.5 text-[0.8rem] text-panel-muted">Bu danışan için uyarlanmış tarif varyasyonları. Web sitesinde yayınlanmazlar.</p>
        </div>
        {!!data?.items.length && (
          <Link to={`/panel/tarifler?danisan=${clientId}`} className="text-[0.8rem] font-semibold text-cocoa hover:underline">Tümünü yönet</Link>
        )}
      </div>
      {!data?.items.length ? (
        <p className="flex items-start gap-2.5 border-t border-panel-line px-5 py-4 text-[0.8rem] text-panel-muted">
          <CookingPot className="mt-0.5 h-4 w-4 shrink-0" />
          Henüz yok. Plan düzenleyicide bir tarifin yanındaki “uyarla” düğmesiyle ya da Tarifler sayfasında “Varyasyon oluştur” ile hazırlayabilirsiniz.
        </p>
      ) : (
        <ul className="grid gap-2 border-t border-panel-line p-4 sm:grid-cols-2">
          {data.items.map((r) => (
            <li key={r.id} className="flex items-center gap-3 rounded-lg border border-panel-line p-2">
              <RecipeThumb recipe={r} className="h-12 w-16 shrink-0 rounded-md" />
              <div className="min-w-0">
                <p className="truncate text-[0.85rem] font-bold text-espresso">{r.title}</p>
                <p className="truncate text-[0.75rem] text-panel-muted">{r.variantNote || RECIPE_CATEGORY_LABEL[r.category]}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function ClientPlansTab({ clientId, clientName }: { clientId: string; clientName: string }) {
  const { data, loading, error, reload } = useApi(() => api.get<{ items: PlanListItem[] }>('/plans', { clientId }), [clientId]);
  const [open, setOpen] = useState(false);

  const pdf = (id: string) => void openPlanPrint(id);

  return (
    <>
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-4">
        <div>
          <h2 className="text-[0.95rem] font-bold text-espresso">Beslenme planları</h2>
          <p className="mt-0.5 text-[0.8rem] text-panel-muted">A4 yazdırma sayfası açılır; yazdırabilir ya da “PDF olarak kaydet” ile PDF alabilirsiniz.</p>
        </div>
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>Yeni plan</Button>
      </div>
      {loading && !data ? (
        <SkeletonRows rows={3} />
      ) : error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : !data?.items.length ? (
        <EmptyState
          icon={<FileText className="h-5 w-5" />}
          title="Henüz plan yok"
          description="Şablondan başlayıp danışana göre düzenleyebilirsiniz."
          action={<Button onClick={() => setOpen(true)} icon={<Plus className="h-4 w-4" />}>İlk planı oluştur</Button>}
        />
      ) : (
        <ul className="divide-y divide-panel-line border-t border-panel-line">
          {data.items.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
              <Link to={`/panel/planlar/${p.id}`} className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-espresso hover:underline">{p.name}</p>
                <p className="text-[0.78rem] text-panel-muted">Son düzenleme {formatDateTime(p.updatedAt)}</p>
              </Link>
              <Button variant="secondary" size="sm" icon={<Printer className="h-4 w-4" />} onClick={() => pdf(p.id)}>Yazdır / PDF</Button>
              <Link to={`/panel/planlar/${p.id}`} className="text-[0.8rem] font-semibold text-cocoa hover:underline">Düzenle</Link>
            </li>
          ))}
        </ul>
      )}
      <NewPlanModal open={open} onClose={() => setOpen(false)} clientId={clientId} clientName={clientName} />
    </Card>
    <ClientRecipes clientId={clientId} />
    </>
  );
}
