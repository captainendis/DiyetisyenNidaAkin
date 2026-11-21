// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Plana tarif ekleme: kütüphaneden çoklu seçim (kategori + arama); buradan yeni tarif de eklenebilir
 * (web: RecipePickerModal). Yeni tarif formu aynı sayfada açılır (iç içe pencere açılmaz).
 */
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, Chips, Empty, Grid, Sheet, TextField } from '@/components/ui';
import { RECIPE_CATEGORIES, RECIPE_CATEGORY_LABEL, type Recipe, type RecipeCategory } from '@shared/recipe';
import { normTr } from './api';
import { RecipeCard } from './RecipeCard';
import { RecipeFormFields } from './RecipeFormFields';
import { recipeFormSubtitle, recipeFormTitle, recipeSaveLabel } from './RecipeFormSheet';
import { useRecipeForm } from './useRecipeForm';

export function RecipePickerSheet({
  open,
  onClose,
  library,
  alreadyAdded,
  limit,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  library: Recipe[];
  alreadyAdded: string[];
  /** Plana daha kaç tarif eklenebilir */
  limit: number;
  onPick: (recipes: Recipe[]) => void;
}) {
  const [category, setCategory] = useState<RecipeCategory | ''>('');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  /** Yeni oluşturulan tarifler (kütüphane sorgusu tazelenene kadar da seçilebilsin) */
  const [created, setCreated] = useState<Recipe[]>([]);
  const form = useRecipeForm((r) => {
    setCreated((c) => [r, ...c]);
    setSel((s) => (s.length < limit ? [...s, r.id] : s));
  });

  useEffect(() => {
    if (open) {
      setSel([]);
      setQ('');
      setCreating(false);
      setCreated([]);
    }
  }, [open]);

  const pool = [...created.filter((c) => !library.some((r) => r.id === c.id)), ...library];
  const items = pool.filter(
    (r) => !alreadyAdded.includes(r.id) && (!category || r.category === category) && (!q.trim() || normTr(`${r.title} ${r.summary} ${r.ingredients.join(' ')}`).includes(normTr(q.trim()))),
  );
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= limit ? s : [...s, id]));
  const startCreate = () => {
    form.reset({ defaultCategory: category || undefined });
    setCreating(true);
  };

  if (creating) {
    return (
      <Sheet
        visible={open}
        onClose={() => setCreating(false)}
        full
        title={recipeFormTitle(form)}
        subtitle={recipeFormSubtitle(form)}
        footer={
          <>
            <Button title="Geri" variant="secondary" onPress={() => setCreating(false)} style={{ flex: 1 }} />
            <Button
              title={recipeSaveLabel(form)}
              loading={form.pending}
              style={{ flex: 1.4 }}
              onPress={async () => {
                if (await form.save()) setCreating(false);
              }}
            />
          </>
        }
      >
        <RecipeFormFields form={form} />
      </Sheet>
    );
  }

  return (
    <Sheet
      visible={open}
      onClose={onClose}
      full
      title="Plana tarif ekle"
      subtitle={limit > 0 ? `Seçtiğiniz tarifler planın arkasına ek sayfa olarak basılır. En fazla ${limit} tarif daha ekleyebilirsiniz.` : 'Bu plana eklenebilecek tarif sınırına ulaşıldı.'}
      footer={
        <>
          <Button title="Yeni tarif" icon="plus" variant="secondary" onPress={startCreate} style={{ flex: 1 }} />
          <Button
            title={sel.length ? `${sel.length} tarifi ekle` : 'Tarif seçin'}
            disabled={!sel.length}
            style={{ flex: 1.3 }}
            onPress={() => {
              onPick(sel.map((id) => pool.find((r) => r.id === id)).filter((r): r is Recipe => !!r));
              onClose();
            }}
          />
        </>
      }
    >
      <TextField value={q} onChange={setQ} placeholder="Tarif veya malzeme ara" icon="search" autoCorrect={false} accessibilityLabel="Tarif ara" />
      <Chips<RecipeCategory | ''>
        value={category}
        options={[{ value: '', label: 'Tümü' }, ...RECIPE_CATEGORIES.map((c) => ({ value: c, label: RECIPE_CATEGORY_LABEL[c] }))]}
        onChange={(v) => setCategory(v as RecipeCategory | '')}
      />
      {!items.length ? (
        <Empty
          icon="coffee"
          title={pool.length ? 'Eklenebilecek tarif bulunamadı' : 'Kütüphanede henüz tarif yok'}
          text={pool.length ? 'Süzgeci değiştirin ya da yeni tarif ekleyin.' : 'Buradan ilk tarifinizi ekleyebilirsiniz.'}
          action={<Button title="Yeni tarif" icon="plus" onPress={startCreate} />}
        />
      ) : (
        <View>
          <Grid>
            {items.map((r) => (
              <RecipeCard key={r.id} recipe={r} selected={sel.includes(r.id)} onPress={() => toggle(r.id)} />
            ))}
          </Grid>
        </View>
      )}
    </Sheet>
  );
}
