// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Tarif ekle / düzenle / varyasyon oluştur — alttan açılan tam sayfa (web: RecipeFormModal) */
import { useEffect } from 'react';
import { Button, Sheet } from '@/components/ui';
import type { Recipe } from '@shared/recipe';
import { RecipeFormFields } from './RecipeFormFields';
import { useRecipeForm, type RecipeForm, type RecipeFormInit } from './useRecipeForm';

export function recipeFormTitle(form: RecipeForm) {
  return form.editing ? 'Tarifi düzenle' : form.base ? 'Varyasyon oluştur' : 'Yeni tarif';
}
export function recipeFormSubtitle(form: RecipeForm) {
  return form.base
    ? `“${form.base.title}” tarifinden başlar. Değiştirdiğiniz yerler yalnızca bu varyasyona uygulanır; ana tarif aynı kalır.`
    : 'Tarifler beslenme planlarının arkasına ek sayfa olarak eklenebilir.';
}
export function recipeSaveLabel(form: RecipeForm) {
  return form.editing ? 'Kaydet' : form.base ? 'Varyasyonu kaydet' : 'Tarifi ekle';
}

export function RecipeFormSheet({ open, onClose, onSaved, ...init }: RecipeFormInit & { open: boolean; onClose: () => void; onSaved?: (r: Recipe) => void }) {
  const form = useRecipeForm((r) => onSaved?.(r));
  const { reset } = form;
  useEffect(() => {
    if (open) reset(init);
    // Yalnızca açılışta kurulur
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reset]);

  return (
    <Sheet
      visible={open}
      onClose={onClose}
      full
      title={recipeFormTitle(form)}
      subtitle={recipeFormSubtitle(form)}
      footer={
        <>
          <Button title="Vazgeç" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
          <Button
            title={recipeSaveLabel(form)}
            loading={form.pending}
            style={{ flex: 1.4 }}
            onPress={async () => {
              if (await form.save()) onClose();
            }}
          />
        </>
      }
    >
      <RecipeFormFields form={form} />
    </Sheet>
  );
}
