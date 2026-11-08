// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Plana tarif ekleme: kütüphaneden çoklu seçim (kategori + arama); buradan yeni tarif de eklenebilir */
import { useEffect, useState } from 'react';
import { CookingPot, Plus, Search } from 'lucide-react';
import { Button, EmptyState, Modal } from '@/components/panel/ui';
import { RecipeFormModal } from './RecipeFormModal';
import { CategoryChips, RecipeCard } from './RecipeCard';
import type { Recipe, RecipeCategory } from '@shared/recipe';

const norm = (s: string) => s.toLocaleLowerCase('tr-TR');

export function RecipePickerModal({
  open, onClose, library, alreadyAdded, limit, onPick, onCreated,
}: {
  open: boolean;
  onClose: () => void;
  library: Recipe[];
  alreadyAdded: string[];
  /** Plana daha kaç tarif eklenebilir */
  limit: number;
  onPick: (recipes: Recipe[]) => void;
  onCreated: (r: Recipe) => void;
}) {
  const [category, setCategory] = useState<RecipeCategory | ''>('');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (open) { setSel([]); setQ(''); }
  }, [open]);

  const items = library.filter(
    (r) => !alreadyAdded.includes(r.id) && (!category || r.category === category) && (!q.trim() || norm(`${r.title} ${r.summary} ${r.ingredients.join(' ')}`).includes(norm(q.trim()))),
  );
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= limit ? s : [...s, id]));

  return (
    <>
      <Modal
        open={open && !creating}
        onClose={onClose}
        size="xl"
        title="Plana tarif ekle"
        description={limit > 0 ? `Seçtiğiniz tarifler planın arkasına ek sayfa olarak basılır. En fazla ${limit} tarif daha ekleyebilirsiniz.` : 'Bu plana eklenebilecek tarif sınırına ulaşıldı.'}
        footer={
          <>
            <Button variant="ghost" className="mr-auto" icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>Yeni tarif</Button>
            <Button variant="secondary" onClick={onClose}>Vazgeç</Button>
            <Button
              disabled={!sel.length}
              onClick={() => {
                onPick(sel.map((id) => library.find((r) => r.id === id)!).filter(Boolean));
                onClose();
              }}
            >
              {sel.length ? `${sel.length} tarifi ekle` : 'Tarif seçin'}
            </Button>
          </>
        }
      >
        <div className="mb-4 flex flex-col gap-3">
          <label className="relative block">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-panel-muted" />
            <input data-autofocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tarif veya malzeme ara" aria-label="Tarif ara" className="h-10 w-full rounded-lg border border-panel-line bg-white pr-3 pl-9 text-sm focus:border-cocoa focus:outline-none" />
          </label>
          <CategoryChips value={category} onChange={setCategory} />
        </div>
        {!items.length ? (
          <EmptyState
            icon={<CookingPot className="h-5 w-5" />}
            title={library.length ? 'Eklenebilecek tarif bulunamadı' : 'Kütüphanede henüz tarif yok'}
            description={library.length ? 'Süzgeci değiştirin ya da yeni tarif ekleyin.' : 'Buradan ilk tarifinizi ekleyebilirsiniz.'}
            action={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>Yeni tarif</Button>}
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((r) => (
              <RecipeCard key={r.id} recipe={r} selected={sel.includes(r.id)} onClick={() => toggle(r.id)} />
            ))}
          </div>
        )}
      </Modal>
      <RecipeFormModal
        open={open && creating}
        onClose={() => setCreating(false)}
        defaultCategory={category || undefined}
        onSaved={(r) => {
          onCreated(r);
          setSel((s) => (s.length < limit ? [...s, r.id] : s));
        }}
      />
    </>
  );
}
