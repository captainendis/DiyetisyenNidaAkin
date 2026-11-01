// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Beslenme planı düzenleyici formu (kontrollü bileşen) */
import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2, X } from 'lucide-react';
import { Button, Input, Select, Switch, Textarea } from '@/components/panel/ui';
import type { NutritionPlanData, PlanMeal } from '@shared/plan';

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
              <button type="button" aria-label={`${oi + 1}. seçeneği kaldır`} onClick={() => upd((m) => void m.options.splice(oi, 1))} className="absolute top-0 right-0 rounded p-0.5 text-panel-muted hover:text-danger">
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

export function PlanEditorForm({ data, set }: { data: NutritionPlanData; set: Setter }) {
  return (
    <div>
      <Section title="Başlık">
        <Input label="Başlık" value={data.title} maxLength={60} onChange={(e) => set((d) => void (d.title = e.target.value))} hint="Danışan seçiliyse otomatik “Adın beslenme planı” olarak gelir." />
        <Input label="Alt başlık" value={data.subtitle} maxLength={160} onChange={(e) => set((d) => void (d.subtitle = e.target.value))} placeholder="1. ay, 1. liste. Her öğünde üç seçenekten yalnızca birini seç." />
        <Select
          label="Renk teması"
          value={data.theme}
          onChange={(e) => set((d) => void (d.theme = e.target.value as NutritionPlanData['theme']))}
          options={[
            { value: 'green', label: 'Yeşil (örnek plan)' },
            { value: 'brand', label: 'Marka (kahve ve krem)' },
          ]}
        />
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

      <Section title="Alt bilgi">
        <Input label="Alt not" value={data.footerNote} maxLength={160} onChange={(e) => set((d) => void (d.footerNote = e.target.value))} />
        <Input label="İmza" value={data.signature} maxLength={80} hint="İletişim ayarlarında telefon varsa yeni planlarda otomatik eklenir." onChange={(e) => set((d) => void (d.signature = e.target.value))} />
      </Section>
    </div>
  );
}
