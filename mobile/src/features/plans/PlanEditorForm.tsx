// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Beslenme planı düzenleyici formu (kontrollü) — web: src/components/panel/plans/PlanEditorForm.tsx */
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { Button, Card, FieldRow, Icon, IconButton, Section, Sheet, Sortable, SwitchField, T, TextField } from '@/components/ui';
import { colors, space } from '@/theme';
import type { NutritionPlanData } from '@shared/plan';
import type { Recipe } from '@shared/recipe';
import type { ClientRef } from '@/features/recipes/api';
import type { PlanSetter } from './api';
import { MealEditor } from './MealEditor';
import { PlanRecipesSection } from './PlanRecipesSection';
import { ThemePicker } from './ThemePicker';

function Block({ title, description, action, children }: { title: string; description?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <Section title={title} action={action}>
      <Card style={{ gap: space.md }}>
        {description ? <T variant="caption">{description}</T> : null}
        {children}
      </Card>
    </Section>
  );
}

const litersFor = (glasses: number, ml: number) => (glasses && ml ? String(Math.round(((glasses * ml) / 1000) * 10) / 10).replace('.', ',') : '');
const toInt = (v: string, max: number) => Math.min(max, Math.max(0, Number(v.replace(/\D/g, '')) || 0));

export function PlanEditorForm({
  data,
  set,
  library,
  client,
  editable,
}: {
  data: NutritionPlanData;
  set: PlanSetter;
  library?: Recipe[];
  client?: ClientRef | null;
  editable: boolean;
}) {
  const [ordering, setOrdering] = useState(false);
  const moveMeal = (from: number, to: number) => set((d) => void d.meals.splice(to, 0, d.meals.splice(from, 1)[0]!));
  const add = (title: string, onPress: () => void, show: boolean) =>
    editable && show ? <Button title={title} icon="plus" variant="ghost" size="sm" onPress={onPress} /> : undefined;

  return (
    <View>
      <Block title="Başlık">
        <TextField label="Başlık" value={data.title} maxLength={60} editable={editable} help="Danışan seçiliyse otomatik “Adın beslenme planı” olarak gelir." onChange={(v) => set((d) => void (d.title = v))} />
        <TextField label="Alt başlık" value={data.subtitle} maxLength={160} rows={2} editable={editable} placeholder="Ör. Her öğünde seçeneklerden yalnızca birini seç." onChange={(v) => set((d) => void (d.subtitle = v))} />
        <ThemePicker value={data.theme} disabled={!editable} onChange={(v) => set((d) => void (d.theme = v))} />
      </Block>

      <Block title="Su ve hareket" description="Danışanın çıktıda işaretleyebileceği takip alanları.">
        <SwitchField label="Su takibi" value={data.water.show} disabled={!editable} onChange={(v) => set((d) => void (d.water.show = v))} />
        {data.water.show ? (
          <FieldRow>
            <TextField
              label="Bardak"
              keyboardType="number-pad"
              value={data.water.glasses ? String(data.water.glasses) : ''}
              editable={editable}
              onChange={(v) =>
                set((d) => {
                  d.water.glasses = toInt(v, 30);
                  d.water.liters = litersFor(d.water.glasses, d.water.glassMl);
                })
              }
            />
            <TextField
              label="Bardak (ml)"
              keyboardType="number-pad"
              value={data.water.glassMl ? String(data.water.glassMl) : ''}
              editable={editable}
              onChange={(v) =>
                set((d) => {
                  d.water.glassMl = toInt(v, 1000);
                  d.water.liters = litersFor(d.water.glasses, d.water.glassMl);
                })
              }
            />
            <TextField label="Litre" value={data.water.liters} maxLength={10} editable={editable} help="Otomatik" keyboardType="decimal-pad" onChange={(v) => set((d) => void (d.water.liters = v))} />
          </FieldRow>
        ) : null}
        <SwitchField label="Hareket takibi (haftanın günleri)" value={data.activity.show} disabled={!editable} onChange={(v) => set((d) => void (d.activity.show = v))} />
        {data.activity.show ? (
          <TextField label="Hareket hedefi" value={data.activity.label} maxLength={40} editable={editable} placeholder="Yürüyüş, 30–45 dk" onChange={(v) => set((d) => void (d.activity.label = v))} />
        ) : null}
      </Block>

      <Block
        title="Öğünler"
        description="Her seçenekte bir satır = bir besin. Danışan her öğünde seçeneklerden birini uygular."
        action={add('Öğün', () => set((d) => void d.meals.push({ time: '', name: '', options: [[], [], []] })), data.meals.length < 7)}
      >
        {!data.meals.length ? <T muted>Henüz öğün yok. “Öğün” ile ekleyin.</T> : null}
        {editable && data.meals.length > 2 ? (
          <Button title="Öğün sırasını düzenle" icon="move" variant="ghost" size="sm" style={{ alignSelf: 'flex-start' }} onPress={() => setOrdering(true)} />
        ) : null}
        <Sortable
          items={data.meals}
          keyOf={(_, i) => String(i)}
          gap={space.md}
          enabled={editable}
          labelOf={(m, i) => m.name || `${i + 1}. öğün`}
          onReorder={moveMeal}
          renderItem={(m, i, handle) => <MealEditor meal={m} index={i} count={data.meals.length} set={set} editable={editable} handle={handle} />}
        />
        {/* Uzun kartları ekran boyunca sürüklemek yerine: kısa satırlarla toplu sıralama */}
        <Sheet visible={ordering} onClose={() => setOrdering(false)} title="Öğün sırası" subtitle="Basılı tutup sürükleyin" footer={<Button title="Tamam" full style={{ flex: 1 }} onPress={() => setOrdering(false)} />}>
          <Sortable
            items={data.meals}
            keyOf={(_, i) => String(i)}
            gap={space.sm}
            labelOf={(m, i) => m.name || `${i + 1}. öğün`}
            onReorder={moveMeal}
            renderItem={(m, i, handle) => (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingVertical: 6, paddingHorizontal: space.md }}>
                {handle}
                <T variant="label" style={{ width: 52 }} color={colors.goldInk}>{m.time || '—'}</T>
                <T variant="subheading" style={{ flex: 1 }} numberOfLines={1}>{m.name || `${i + 1}. öğün`}</T>
                <Icon name="coffee" size={15} color={colors.mist} />
              </View>
            )}
          />
        </Sheet>
      </Block>

      <Block
        title="Alışkanlıklar"
        description="Sol alttaki koyu kutu. Boş bırakılırsa çıktıda gösterilmez."
        action={add('Madde', () => set((d) => void d.habits.items.push({ title: '', text: '' })), data.habits.items.length < 6)}
      >
        <TextField label="Kutu başlığı" value={data.habits.title} maxLength={60} editable={editable} onChange={(v) => set((d) => void (d.habits.title = v))} />
        {data.habits.items.map((h, i) => (
          <View key={i} style={{ gap: space.xs, borderTopWidth: i ? 1 : 0, borderTopColor: colors.line, paddingTop: i ? space.md : 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
              <View style={{ flex: 1 }}>
                <TextField accessibilityLabel="Madde başlığı" placeholder="Su." value={h.title} maxLength={30} editable={editable} onChange={(v) => set((d) => void (d.habits.items[i]!.title = v))} />
              </View>
              {editable ? <IconButton name="trash-2" label="Maddeyi sil" color={colors.dangerInk} onPress={() => set((d) => void d.habits.items.splice(i, 1))} /> : null}
            </View>
            <TextField accessibilityLabel="Madde açıklaması" rows={2} value={h.text} maxLength={220} editable={editable} placeholder="Günde 4,8 litre, yani 20 bardak…" onChange={(v) => set((d) => void (d.habits.items[i]!.text = v))} />
          </View>
        ))}
      </Block>

      <Block
        title="Porsiyon tablosu"
        description="Sağ alttaki tablo (ör. 1 porsiyon meyve). En fazla 12 kutu."
        action={add('Kutu', () => set((d) => void d.portions.items.push({ name: '', amount: '' })), data.portions.items.length < 12)}
      >
        <TextField label="Tablo başlığı" value={data.portions.title} maxLength={40} editable={editable} onChange={(v) => set((d) => void (d.portions.title = v))} />
        {data.portions.items.map((p, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <TextField accessibilityLabel="Besin" placeholder="Kiraz" value={p.name} maxLength={24} editable={editable} onChange={(v) => set((d) => void (d.portions.items[i]!.name = v))} />
            </View>
            <View style={{ flex: 1 }}>
              <TextField accessibilityLabel="Miktar" placeholder="12 adet" value={p.amount} maxLength={24} editable={editable} onChange={(v) => set((d) => void (d.portions.items[i]!.amount = v))} />
            </View>
            {editable ? <IconButton name="x" label="Kutuyu sil" color={colors.muted} onPress={() => set((d) => void d.portions.items.splice(i, 1))} /> : null}
          </View>
        ))}
      </Block>

      <Section title="Tarif önerileri (ek sayfa)">
        <Card>
          <PlanRecipesSection data={data} set={set} library={library} client={client} editable={editable} />
        </Card>
      </Section>

      <Block title="Alt bilgi">
        <TextField label="Alt not" value={data.footerNote} maxLength={160} rows={2} editable={editable} onChange={(v) => set((d) => void (d.footerNote = v))} />
        <TextField label="İmza" value={data.signature} maxLength={80} editable={editable} help="İletişim ayarlarında telefon varsa yeni planlarda otomatik eklenir." onChange={(v) => set((d) => void (d.signature = v))} />
      </Block>
    </View>
  );
}
