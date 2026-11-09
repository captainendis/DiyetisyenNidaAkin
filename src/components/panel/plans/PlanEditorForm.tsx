// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Beslenme planı düzenleyici formu (kontrollü bileşen) */
import { useId, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowDown, ArrowUp, Check, CookingPot, GitBranch, Plus, Trash2, X } from 'lucide-react';
import { Button, Input, Switch, Textarea } from '@/components/panel/ui';
import { cn } from '@/lib/format';
import { RecipePickerModal } from '@/components/panel/recipes/RecipePickerModal';
import { RecipeThumb } from '@/components/panel/recipes/RecipeCard';
import { RecipeFormModal } from '@/components/panel/recipes/RecipeFormModal';
import { recipesVisibleFor } from '@/components/panel/recipes/api';
import type { ClientRef } from '@/components/panel/recipes/ClientPicker';
import { MAX_PLAN_RECIPES, PLAN_THEME_IDS, PLAN_THEMES, type NutritionPlanData, type PlanMeal, type PlanThemeId } from '@shared/plan';
import { RECIPE_CATEGORY_LABEL, RECIPE_DEFAULT_LABEL, recipeMeta, type Recipe } from '@shared/recipe';

type Setter = (fn: (d: NutritionPlanData) => void) => void;

function Section({ title, description, action, children }: { title: string; description?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="border-b border-panel-line px-5 py-5 last:border-0">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[0.9rem] font-bold text-espresso">{title}</h3>
          {description && <p className="mt-0.5 text-[0.78rem] text-panel-muted">{description}</p>}
        </div>
        {action}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

const litersFor = (glasses: number, ml: number) =>
  glasses && ml ? String(Math.round(((glasses * ml) / 1000) * 10) / 10).replace('.', ',') : '';

function MealEditor({ meal, index, count, set }: { meal: PlanMeal; index: number; count: number; set: Setter }) {
  const upd = (fn: (m: PlanMeal) => void) => set((d) => fn(d.meals[index]!));
  return (
    <div className="rounded-lg border border-panel-line bg-panel-bg/40 p-3.5">
      <div className="flex flex-wrap items-end gap-2">
        <Input label="Saat" value={meal.time} maxLength={12} placeholder="06.30" wrapperClassName="w-24" onChange={(e) => upd((m) => void (m.time = e.target.value))} />
        <Input label="Öğün" value={meal.name} maxLength={40} placeholder="Kahvaltı" wrapperClassName="min-w-0 flex-1" onChange={(e) => upd((m) => void (m.name = e.target.value))} />
        <div className="flex gap-0.5 pb-0.5">
          <Button variant="ghost" size="sm" aria-label="Öğünü yukarı taşı" disabled={index === 0} onClick={() => set((d) => void d.meals.splice(index - 1, 0, d.meals.splice(index, 1)[0]!))}><ArrowUp className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" aria-label="Öğünü aşağı taşı" disabled={index === count - 1} onClick={() => set((d) => void d.meals.splice(index + 1, 0, d.meals.splice(index, 1)[0]!))}><ArrowDown className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" aria-label="Öğünü sil" disabled={count === 1} onClick={() => set((d) => void d.meals.splice(index, 1))}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>
      <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
        {meal.options.map((o, oi) => (
          <div key={oi} className="relative">
            <Textarea
              label={meal.options.length > 1 ? `${oi + 1}. seçenek` : 'Öğün içeriği'}
              rows={5}
              value={o.join('\n')}
              placeholder={'Her satıra bir besin\nÖr. 2 haşlanmış yumurta'}
              className="text-[0.82rem] leading-snug"
              onChange={(e) => upd((m) => void (m.options[oi] = e.target.value.split('\n').slice(0, 10)))}
            />
            {meal.options.length > 1 && (
              <button type="button" aria-label={`${oi + 1}. seçeneği kaldır`} onClick={() => upd((m) => void m.options.splice(oi, 1))} className="absolute top-0 right-0 rounded p-0.5 text-panel-muted hover:text-danger-ink">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
      {meal.options.length < 3 && (
        <Button variant="ghost" size="sm" className="mt-2" icon={<Plus className="h-4 w-4" />} onClick={() => upd((m) => void m.options.push([]))}>
          Seçenek ekle
        </Button>
      )}
    </div>
  );
}

function RecipesSection({ data, set, library, onLibraryChange, client }: { data: NutritionPlanData; set: Setter; library?: Recipe[]; onLibraryChange: (r: Recipe) => void; client?: ClientRef | null }) {
  const [picking, setPicking] = useState(false);
  /** Plandaki bir tarifi bu danışana uyarlama (varyasyon) — kaydedilince plandaki tarifin yerini alır */
  const [adapting, setAdapting] = useState<{ index: number; recipe: Recipe } | null>(null);
  const listId = useId();
  const items = data.recipes.items;
  const byId = new Map((library ?? []).map((r) => [r.id, r]));
  const mealNames = [...new Set(data.meals.map((m) => m.name.trim()).filter(Boolean))];
  const suggestions = [...new Set([...mealNames.map((n) => `${n} için öneri`), ...Object.values(RECIPE_DEFAULT_LABEL)])];
  /** Kategoriye uyan bir öğün varsa onun adıyla etiketle (ör. "Kahvaltı için öneri") */
  const labelFor = (r: Recipe) => {
    const cat = RECIPE_CATEGORY_LABEL[r.category].toLocaleLowerCase('tr-TR');
    const meal = mealNames.find((n) => n.toLocaleLowerCase('tr-TR').includes(cat));
    return meal ? `${meal} için öneri` : RECIPE_DEFAULT_LABEL[r.category];
  };

  return (
    <Section
      title="Tarif önerileri (ek sayfa)"
      description={client
        ? `Kütüphaneden seçin ya da ${client.firstName} için uyarlayın; PDF'te planın arkasına fotoğraflarıyla ek sayfa olarak basılır.`
        : "Tarif kütüphanesinden seçin; PDF'te planın arkasına fotoğraflarıyla ek sayfa olarak basılır."}
      action={
        items.length < MAX_PLAN_RECIPES && (
          <Button variant="secondary" size="sm" icon={<Plus className="h-4 w-4" />} disabled={!library} onClick={() => setPicking(true)}>
            Tarif
          </Button>
        )
      }
    >
      {items.length > 0 && (
        <Input label="Ek sayfa başlığı" value={data.recipes.title} maxLength={60} placeholder="Tarif önerileri" onChange={(e) => set((d) => void (d.recipes.title = e.target.value))} />
      )}
      {!items.length ? (
        <button
          type="button"
          onClick={() => setPicking(true)}
          disabled={!library}
          className="flex w-full items-center gap-3 rounded-lg border border-dashed border-panel-line px-4 py-3.5 text-left text-panel-muted hover:border-cocoa/40 hover:text-cocoa"
        >
          <CookingPot className="h-5 w-5 shrink-0" />
          <span className="text-[0.82rem]">
            <span className="block font-semibold">Henüz tarif eklenmedi</span>
            Ör. kahvaltı için yulaflı tost, ara öğün için kefirli smoothie. Tarifleri <Link to="/panel/tarifler" className="underline">Tarifler</Link> sayfasından yönetebilirsiniz.
          </span>
        </button>
      ) : (
        <ul className="space-y-2">
          {items.map((it, i) => {
            const r = byId.get(it.recipeId);
            return (
              <li key={`${it.recipeId}-${i}`} className="flex items-center gap-3 rounded-lg border border-panel-line bg-panel-bg/40 p-2.5">
                {r ? <RecipeThumb recipe={r} className="h-14 w-[4.6rem] shrink-0 rounded-md" /> : <div className="h-14 w-[4.6rem] shrink-0 rounded-md bg-panel-bg" />}
                <div className="min-w-0 flex-1 space-y-1.5">
                  {r ? (
                    <p className="truncate text-[0.85rem] font-bold text-espresso" title={r.title}>
                      {r.clientId && <span className="mr-1.5 rounded-full bg-rose px-1.5 py-px text-[0.66rem] font-bold text-espresso">Sana özel</span>}
                      {r.title}
                      <span className="ml-1.5 font-medium text-panel-muted">· {[r.variantNote || RECIPE_CATEGORY_LABEL[r.category], ...recipeMeta(r).slice(0, 2)].join(' · ')}</span>
                    </p>
                  ) : (
                    <p className="text-[0.82rem] font-semibold text-danger-ink">{library ? 'Bu tarif silinmiş — PDF’te gösterilmez.' : 'Yükleniyor…'}</p>
                  )}
                  <input
                    aria-label="Tarif etiketi"
                    list={listId}
                    value={it.label}
                    maxLength={60}
                    placeholder="Kahvaltı için öneri"
                    onChange={(e) => set((d) => void (d.recipes.items[i]!.label = e.target.value))}
                    className="h-8 w-full rounded-md border border-panel-line bg-white px-2.5 text-[0.8rem] text-espresso focus:border-cocoa focus:outline-none"
                  />
                </div>
                <div className="flex shrink-0 flex-col sm:flex-row">
                  {r && !(client && r.clientId === client.id) && (
                    <Button variant="ghost" size="sm" aria-label={client ? `${client.firstName} için uyarla` : 'Varyasyon oluştur'} title={client ? `${client.firstName} için uyarla` : 'Varyasyon oluştur'} onClick={() => setAdapting({ index: i, recipe: r })}>
                      <GitBranch className="h-4 w-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" aria-label="Yukarı taşı" disabled={i === 0} onClick={() => set((d) => void d.recipes.items.splice(i - 1, 0, d.recipes.items.splice(i, 1)[0]!))}><ArrowUp className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="sm" aria-label="Aşağı taşı" disabled={i === items.length - 1} onClick={() => set((d) => void d.recipes.items.splice(i + 1, 0, d.recipes.items.splice(i, 1)[0]!))}><ArrowDown className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="sm" aria-label="Tarifi plandan çıkar" onClick={() => set((d) => void d.recipes.items.splice(i, 1))}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <RecipeFormModal
        open={!!adapting}
        onClose={() => setAdapting(null)}
        variantOf={adapting?.recipe ?? null}
        defaultClient={client ?? null}
        onSaved={(v) => {
          onLibraryChange(v);
          const idx = adapting?.index;
          if (idx !== undefined) set((d) => { if (d.recipes.items[idx]) d.recipes.items[idx]!.recipeId = v.id; });
        }}
      />
      <datalist id={listId}>
        {suggestions.map((s) => <option key={s} value={s} />)}
      </datalist>
      {library && (
        <RecipePickerModal
          open={picking}
          onClose={() => setPicking(false)}
          library={recipesVisibleFor(library, client?.id)}
          alreadyAdded={items.map((i) => i.recipeId)}
          limit={MAX_PLAN_RECIPES - items.length}
          onCreated={onLibraryChange}
          onPick={(rs) => set((d) => {
            for (const r of rs) if (d.recipes.items.length < MAX_PLAN_RECIPES) d.recipes.items.push({ recipeId: r.id, label: labelFor(r) });
          })}
        />
      )}
    </Section>
  );
}

/**
 * Renk teması seçici: her seçenek, PDF'in küçük bir taslağını temanın gerçek renkleriyle gösterir
 * (zemin, öğün kartı, saat noktası, alışkanlıklar kutusu). Yerel radio düğmeleri — klavye ile oklarla gezilir.
 */
function ThemePicker({ value, onChange }: { value: PlanThemeId; onChange: (v: PlanThemeId) => void }) {
  const name = useId();
  return (
    <fieldset>
      <legend className="mb-1.5 text-[0.8rem] font-semibold text-cocoa">Renk teması</legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {PLAN_THEME_IDS.map((id) => {
          const th = PLAN_THEMES[id];
          const c = th.colors;
          const selected = value === id;
          return (
            <label
              key={id}
              className={cn(
                'relative flex cursor-pointer flex-col gap-2 rounded-lg border bg-white p-2 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-cocoa has-[:focus-visible]:ring-offset-2',
                selected ? 'border-cocoa ring-1 ring-cocoa' : 'border-panel-line hover:border-panel-muted',
              )}
            >
              <input type="radio" name={name} value={id} checked={selected} onChange={() => onChange(id)} className="sr-only" />
              <span aria-hidden className="flex h-12 gap-1 rounded-md p-1.5" style={{ background: c.bg, boxShadow: c.bg.toLowerCase() === '#ffffff' ? `inset 0 0 0 1px ${c.line}` : undefined }}>
                <span className="flex flex-1 items-start gap-1 rounded-sm p-1" style={{ background: c.card, boxShadow: c.card.toLowerCase() === c.bg.toLowerCase() ? `inset 0 0 0 1px ${c.line}` : undefined }}>
                  <span className="mt-px h-2 w-2 shrink-0 rounded-full" style={{ background: c.accent, boxShadow: `0 0 0 1px ${c.ink}` }} />
                  <span className="flex flex-1 flex-col gap-1 pt-px">
                    <span className="h-[3px] w-4/5 rounded-full" style={{ background: c.ink }} />
                    <span className="h-[3px] w-3/5 rounded-full" style={{ background: c.muted }} />
                  </span>
                </span>
                <span className="flex w-1/3 flex-col justify-end rounded-sm p-1" style={{ background: c.dark }}>
                  <span className="h-[3px] w-3/4 rounded-full" style={{ background: c.darkAccent }} />
                </span>
              </span>
              <span className="flex items-start justify-between gap-1 px-0.5">
                <span className="min-w-0">
                  <span className="block text-[0.8rem] leading-tight font-semibold text-espresso">{th.label}</span>
                  <span className="block text-[0.72rem] leading-tight text-panel-muted">{th.note}</span>
                </span>
                {selected && <Check className="h-4 w-4 shrink-0 text-cocoa" aria-hidden />}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function PlanEditorForm({ data, set, library, onLibraryChange, client }: { data: NutritionPlanData; set: Setter; library?: Recipe[]; onLibraryChange: (r: Recipe) => void; client?: ClientRef | null }) {
  return (
    <div>
      <Section title="Başlık">
        <Input label="Başlık" value={data.title} maxLength={60} onChange={(e) => set((d) => void (d.title = e.target.value))} hint="Danışan seçiliyse otomatik “Adın beslenme planı” olarak gelir." />
        <Input label="Alt başlık" value={data.subtitle} maxLength={160} onChange={(e) => set((d) => void (d.subtitle = e.target.value))} placeholder="1. ay, 1. liste. Her öğünde üç seçenekten yalnızca birini seç." />
        <ThemePicker value={data.theme} onChange={(v) => set((d) => void (d.theme = v))} />
      </Section>

      <Section title="Su ve hareket" description="Danışanın çıktıda işaretleyebileceği takip alanları.">
        <Switch label="Su takibi" checked={data.water.show} onChange={(v) => set((d) => void (d.water.show = v))} />
        {data.water.show && (
          <div className="grid grid-cols-3 gap-2">
            <Input
              label="Bardak"
              type="number"
              min={0}
              max={30}
              value={data.water.glasses || ''}
              onChange={(e) => set((d) => {
                d.water.glasses = Math.min(30, Math.max(0, Number(e.target.value) || 0));
                d.water.liters = litersFor(d.water.glasses, d.water.glassMl);
              })}
            />
            <Input
              label="Bardak (ml)"
              type="number"
              min={0}
              max={1000}
              value={data.water.glassMl || ''}
              onChange={(e) => set((d) => {
                d.water.glassMl = Math.min(1000, Math.max(0, Number(e.target.value) || 0));
                d.water.liters = litersFor(d.water.glasses, d.water.glassMl);
              })}
            />
            <Input label="Litre" value={data.water.liters} maxLength={10} onChange={(e) => set((d) => void (d.water.liters = e.target.value))} hint="Otomatik" />
          </div>
        )}
        <Switch label="Hareket takibi (haftanın günleri)" checked={data.activity.show} onChange={(v) => set((d) => void (d.activity.show = v))} />
        {data.activity.show && (
          <Input label="Hareket hedefi" value={data.activity.label} maxLength={40} placeholder="Yürüyüş, 30–45 dk" onChange={(e) => set((d) => void (d.activity.label = e.target.value))} />
        )}
      </Section>

      <Section
        title="Öğünler"
        description="Her seçenekte bir satır = bir besin. Danışan her öğünde seçeneklerden birini uygular."
        action={
          data.meals.length < 7 && (
            <Button variant="secondary" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => set((d) => void d.meals.push({ time: '', name: '', options: [[], [], []] }))}>
              Öğün
            </Button>
          )
        }
      >
        {data.meals.map((m, i) => (
          <MealEditor key={i} meal={m} index={i} count={data.meals.length} set={set} />
        ))}
      </Section>

      <Section
        title="Alışkanlıklar"
        description="Sol alttaki koyu kutu. Boş bırakılırsa çıktıda gösterilmez."
        action={
          data.habits.items.length < 6 && (
            <Button variant="secondary" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => set((d) => void d.habits.items.push({ title: '', text: '' }))}>
              Madde
            </Button>
          )
        }
      >
        <Input label="Kutu başlığı" value={data.habits.title} maxLength={60} onChange={(e) => set((d) => void (d.habits.title = e.target.value))} />
        {data.habits.items.map((h, i) => (
          <div key={i} className="flex items-start gap-2">
            <Input aria-label="Madde başlığı" placeholder="Su." value={h.title} maxLength={30} wrapperClassName="w-32 shrink-0" onChange={(e) => set((d) => void (d.habits.items[i]!.title = e.target.value))} />
            <Textarea aria-label="Madde açıklaması" rows={2} value={h.text} maxLength={220} wrapperClassName="min-w-0 flex-1" onChange={(e) => set((d) => void (d.habits.items[i]!.text = e.target.value))} />
            <Button variant="ghost" size="sm" aria-label="Maddeyi sil" onClick={() => set((d) => void d.habits.items.splice(i, 1))}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
      </Section>

      <Section
        title="Porsiyon tablosu"
        description="Sağ alttaki tablo (ör. 1 porsiyon meyve). En fazla 12 kutu."
        action={
          data.portions.items.length < 12 && (
            <Button variant="secondary" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => set((d) => void d.portions.items.push({ name: '', amount: '' }))}>
              Kutu
            </Button>
          )
        }
      >
        <Input label="Tablo başlığı" value={data.portions.title} maxLength={40} onChange={(e) => set((d) => void (d.portions.title = e.target.value))} />
        <div className="grid gap-2 sm:grid-cols-2">
          {data.portions.items.map((p, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <Input aria-label="Besin" placeholder="Kiraz" value={p.name} maxLength={24} wrapperClassName="min-w-0 flex-1" onChange={(e) => set((d) => void (d.portions.items[i]!.name = e.target.value))} />
              <Input aria-label="Miktar" placeholder="12 adet" value={p.amount} maxLength={24} wrapperClassName="min-w-0 flex-1" onChange={(e) => set((d) => void (d.portions.items[i]!.amount = e.target.value))} />
              <Button variant="ghost" size="sm" aria-label="Kutuyu sil" onClick={() => set((d) => void d.portions.items.splice(i, 1))}><X className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      </Section>

      <RecipesSection data={data} set={set} library={library} onLibraryChange={onLibraryChange} client={client} />

      <Section title="Alt bilgi">
        <Input label="Alt not" value={data.footerNote} maxLength={160} onChange={(e) => set((d) => void (d.footerNote = e.target.value))} />
        <Input label="İmza" value={data.signature} maxLength={80} hint="İletişim ayarlarında telefon varsa yeni planlarda otomatik eklenir." onChange={(e) => set((d) => void (d.signature = e.target.value))} />
      </Section>
    </div>
  );
}
