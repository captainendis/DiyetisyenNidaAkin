// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import type { ReactNode } from 'react';
import { Check, CookingPot, GitBranch, Globe, House, UserRound } from 'lucide-react';
import { cn } from '@/lib/format';
import { RECIPE_CATEGORIES, RECIPE_CATEGORY_LABEL, recipeImageUrl, recipeMeta, type Recipe, type RecipeCategory } from '@shared/recipe';
import { Select } from '@/components/panel/ui/Field';

export function RecipeThumb({ recipe, className }: { recipe: Pick<Recipe, 'imageBase'>; className?: string }) {
  return (
    <div className={cn('overflow-hidden bg-panel-bg', className)}>
      {recipe.imageBase ? (
        <img src={recipeImageUrl(recipe.imageBase, 480)} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-panel-muted/60">
          <CookingPot className="h-1/3 max-h-10 w-1/3 max-w-10" strokeWidth={1.4} />
        </div>
      )}
    </div>
  );
}

/** Kütüphane kartı; `selected` verilirse seçilebilir kart olarak davranır */
export function RecipeCard({ recipe, onClick, selected, footer }: { recipe: Recipe; onClick?: () => void; selected?: boolean; footer?: ReactNode }) {
  const meta = recipeMeta(recipe).slice(0, 3);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected === undefined ? undefined : selected}
      className={cn(
        'group relative flex w-full flex-col overflow-hidden rounded-xl bg-white text-left ring-1 ring-panel-line transition-shadow hover:shadow-[0_10px_30px_-16px_rgba(33,23,16,0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cocoa',
        selected && 'ring-2 ring-cocoa',
      )}
    >
      <RecipeThumb recipe={recipe} className="aspect-[4/3] w-full" />
      {selected !== undefined && (
        <span className={cn('absolute top-2.5 right-2.5 grid h-7 w-7 place-items-center rounded-full ring-2 ring-white', selected ? 'bg-cocoa text-ivory' : 'bg-white/90 text-transparent')}>
          <Check className="h-4 w-4" />
        </span>
      )}
      <RecipeBadges recipe={recipe} className="absolute top-2.5 left-2.5" />
      <div className="flex flex-1 flex-col gap-1 px-3.5 pt-3 pb-3.5">
        <p className="text-[0.68rem] font-bold tracking-[0.12em] text-panel-muted uppercase">{RECIPE_CATEGORY_LABEL[recipe.category]}</p>
        <p className="line-clamp-2 text-[0.95rem] leading-snug font-bold text-espresso">{recipe.title}</p>
        {(recipe.client || recipe.variantNote) && (
          <p className="line-clamp-2 text-[0.78rem] leading-snug font-semibold text-cocoa">
            {[recipe.client ? `${recipe.client.firstName} ${recipe.client.lastName} için` : '', recipe.variantNote].filter(Boolean).join(' · ')}
          </p>
        )}
        {meta.length > 0 && <p className="mt-auto pt-1 text-[0.75rem] text-panel-muted">{meta.join(' · ')}</p>}
        {footer}
      </div>
    </button>
  );
}

/** Yayında / kişiye özel / varyasyon rozetleri */
export function RecipeBadges({ recipe, className }: { recipe: Recipe; className?: string }) {
  const items = [
    recipe.isPublished && { icon: Globe, text: 'Yayında', cls: 'bg-[#2f6b4f] text-white' },
    recipe.isFeatured && { icon: House, text: 'Ana sayfada', cls: 'bg-gold text-espresso' },
    recipe.client && { icon: UserRound, text: 'Kişiye özel', cls: 'bg-rose text-espresso' },
    !recipe.client && recipe.parentId && { icon: GitBranch, text: 'Varyasyon', cls: 'bg-white/90 text-cocoa' },
    !recipe.parentId && recipe.variantCount > 0 && { icon: GitBranch, text: `${recipe.variantCount} varyasyon`, cls: 'bg-white/90 text-cocoa' },
  ].filter(Boolean) as { icon: typeof Globe; text: string; cls: string }[];
  if (!items.length) return null;
  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {items.map((b) => (
        <span key={b.text} className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.68rem] font-bold shadow-sm', b.cls)}>
          <b.icon className="h-3 w-3" /> {b.text}
        </span>
      ))}
    </div>
  );
}

/** Kategori süzgeci: telefonda açılır liste, geniş ekranda çipler */
export function CategoryChips({ value, onChange, counts }: { value: RecipeCategory | ''; onChange: (v: RecipeCategory | '') => void; counts?: Partial<Record<RecipeCategory | '', number>> }) {
  const all: (RecipeCategory | '')[] = ['', ...RECIPE_CATEGORIES];
  const label = (c: RecipeCategory | '') => `${c ? RECIPE_CATEGORY_LABEL[c] : 'Tümü'}${counts?.[c] !== undefined ? ` (${counts[c]})` : ''}`;
  return (
    <>
    <Select
      aria-label="Kategori"
      wrapperClassName="sm:hidden"
      value={value}
      onChange={(e) => onChange(e.target.value as RecipeCategory | '')}
      options={all.map((c) => ({ value: c, label: label(c) }))}
    />
    <div className="-mx-1 hidden gap-1.5 overflow-x-auto px-1 pb-1 sm:flex" role="group" aria-label="Kategoriye göre süz">
      {all.map((c) => (
        <button
          key={c || 'all'}
          type="button"
          aria-pressed={value === c}
          onClick={() => onChange(c)}
          className={cn(
            'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[0.8rem] font-semibold transition-colors',
            value === c ? 'bg-cocoa text-ivory' : 'bg-white text-cocoa ring-1 ring-inset ring-panel-line hover:bg-panel-bg',
          )}
        >
          {c ? RECIPE_CATEGORY_LABEL[c] : 'Tümü'}
          {counts?.[c] !== undefined && <span className={cn('tabular text-[0.72rem]', value === c ? 'text-ivory/70' : 'text-panel-muted')}>{counts[c]}</span>}
        </button>
      ))}
    </div>
    </>
  );
}
