// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Tarif ekle / düzenle / varyasyon oluştur — durum ve kayıt mantığı (web: RecipeFormModal.tsx).
 *  - Fotoğraf seçilince yerelde önizlenir; tarif kaydedildikten sonra yüklenir ("file" alanı).
 *  - Varyasyon: ana tarifin kopyasıyla başlar (fotoğraf sunucuda kopyalanır); bir danışana bağlanabilir.
 */
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useState } from 'react';
import { useToast } from '@/components/ui';
import { api, ApiError, errorMessage, type UploadFile } from '@/lib/api';
import { queryClient } from '@/lib/query';
import { normalizeDietTags, type DietTag, type Recipe, type RecipeCategory, type RecipeInput } from '@shared/recipe';
import type { ClientRef } from './api';

const MAX_UPLOAD = 15 * 1024 * 1024;

export interface RecipeDraft {
  title: string;
  category: RecipeCategory | '';
  summary: string;
  servings: string;
  prepMinutes: string;
  cookMinutes: string;
  kcal: string;
  ingredients: string;
  steps: string[];
  tip: string;
  dietTags: DietTag[];
  isPublished: boolean;
  isFeatured: boolean;
  variantNote: string;
  client: ClientRef | null;
}

const toDraft = (r?: Recipe | null, category?: RecipeCategory): RecipeDraft => ({
  isPublished: r?.isPublished ?? false,
  isFeatured: r?.isFeatured ?? false,
  variantNote: r?.variantNote ?? '',
  client: r?.client ?? null,
  title: r?.title ?? '',
  category: r?.category ?? category ?? '',
  summary: r?.summary ?? '',
  servings: r?.servings ? String(r.servings) : '',
  prepMinutes: r?.prepMinutes ? String(r.prepMinutes) : '',
  cookMinutes: r?.cookMinutes ? String(r.cookMinutes) : '',
  kcal: r?.kcal ? String(r.kcal) : '',
  ingredients: r?.ingredients.join('\n') ?? '',
  steps: r?.steps.length ? [...r.steps] : [''],
  tip: r?.tip ?? '',
  dietTags: r?.dietTags ?? [],
});

/** Varyasyon taslağı: ana tarifin içeriği, yayın kapalı, isteğe bağlı danışan */
const variantDraft = (base: Recipe, client: ClientRef | null): RecipeDraft => ({ ...toDraft(base), isPublished: false, isFeatured: false, variantNote: '', client });

const num = (v: string) => {
  const n = Number(v.replace(',', '.'));
  return v.trim() && Number.isFinite(n) ? Math.round(n) : null;
};

export type RecipeFormMode = { kind: 'new' } | { kind: 'edit'; recipe: Recipe } | { kind: 'variant'; base: Recipe };

export interface RecipeFormInit {
  recipe?: Recipe | null;
  /** Verilirse bu tarifin varyasyonu oluşturulur */
  variantOf?: Recipe | null;
  /** Varyasyon için önceden seçili danışan (ör. plan düzenleyiciden) */
  defaultClient?: ClientRef | null;
  defaultCategory?: RecipeCategory;
}

export function useRecipeForm(onSaved: (r: Recipe) => void) {
  const toast = useToast();
  const [mode, setMode] = useState<RecipeFormMode>({ kind: 'new' });
  const [d, setD] = useState<RecipeDraft>(() => toDraft());
  const [err, setErr] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [file, setFile] = useState<UploadFile | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [defaultClient, setDefaultClient] = useState<ClientRef | null>(null);

  /** Formu baştan kurar (sayfa her açıldığında) */
  const reset = useCallback((init: RecipeFormInit = {}) => {
    setMode(init.variantOf ? { kind: 'variant', base: init.variantOf } : init.recipe ? { kind: 'edit', recipe: init.recipe } : { kind: 'new' });
    setD(init.variantOf ? variantDraft(init.variantOf, init.defaultClient ?? null) : toDraft(init.recipe, init.defaultCategory));
    setDefaultClient(init.defaultClient ?? null);
    setErr({});
    setFile(null);
    setRemoveImage(false);
  }, []);

  const editing = mode.kind === 'edit' ? mode.recipe : null;
  const base = mode.kind === 'variant' ? mode.base : null;
  const imageOwner = editing ?? base;
  const isVariant = !!base || !!editing?.parentId || !!d.client || !!d.variantNote;
  /** Gösterilecek görsel: yerel seçim (uri) ya da sunucudaki görselin tabanı */
  const image: { local: string } | { base: string } | null = file
    ? { local: file.uri }
    : !removeImage && imageOwner?.imageBase
      ? { base: imageOwner.imageBase }
      : null;

  const startVariant = () => {
    if (!editing) return;
    setMode({ kind: 'variant', base: editing });
    setD(variantDraft(editing, defaultClient));
    setErr({});
    setFile(null);
    setRemoveImage(false);
  };

  const set = <K extends keyof RecipeDraft>(k: K, v: RecipeDraft[K]) => setD((p) => ({ ...p, [k]: v }));
  const setClient = (c: ClientRef | null) => setD((p) => ({ ...p, client: c, isPublished: c ? false : p.isPublished }));
  // Vegan işaretlenince vejetaryen de işaretlenir; vejetaryen, vegan açıkken kapatılamaz
  const toggleDiet = (t: DietTag, on: boolean) => setD((p) => ({ ...p, dietTags: normalizeDietTags(on ? [...p.dietTags, t] : p.dietTags.filter((x) => x !== t)) }));
  const setStep = (i: number, v: string) => setD((p) => ({ ...p, steps: p.steps.map((s, j) => (j === i ? v : s)) }));
  const moveStep = (i: number, to: number) =>
    setD((p) => {
      const steps = [...p.steps];
      steps.splice(to, 0, steps.splice(i, 1)[0]!);
      return { ...p, steps };
    });
  const addStep = () => setD((p) => ({ ...p, steps: [...p.steps, ''] }));
  const removeStep = (i: number) => setD((p) => ({ ...p, steps: p.steps.filter((_, j) => j !== i) }));

  /** Fotoğraf seç (galeri) ya da çek (kamera); 4:3 kırpılır */
  const pickImage = async (source: 'library' | 'camera') => {
    try {
      const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.85, exif: false };
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) return toast('Kamera izni verilmedi. Ayarlardan izin verebilirsiniz.', 'error');
      }
      const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      const a = res.canceled ? null : res.assets[0];
      if (!a) return;
      if (a.fileSize && a.fileSize > MAX_UPLOAD) return toast('Fotoğraf çok büyük — en fazla 15 MB yükleyebilirsiniz.', 'error');
      const type = a.mimeType ?? 'image/jpeg';
      const ext = type.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
      setFile({ uri: a.uri, name: a.fileName ?? `tarif.${ext}`, type });
      setRemoveImage(false);
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };
  const clearImage = () => {
    setFile(null);
    setRemoveImage(true);
  };

  /** Kaydeder; başarılıysa true döner */
  const save = async (): Promise<boolean> => {
    const body: RecipeInput = {
      title: d.title.trim(),
      category: d.category as RecipeCategory,
      summary: d.summary.trim(),
      servings: num(d.servings),
      prepMinutes: num(d.prepMinutes),
      cookMinutes: num(d.cookMinutes),
      kcal: num(d.kcal),
      ingredients: d.ingredients.split('\n').map((l) => l.replace(/^\s*[-•*]\s*/, '').trim()).filter(Boolean),
      steps: d.steps.map((s) => s.trim()).filter(Boolean),
      tip: d.tip.trim(),
      dietTags: normalizeDietTags(d.dietTags),
      isPublished: d.client ? false : d.isPublished,
      isFeatured: !d.client && d.isPublished && d.isFeatured,
      variantNote: d.variantNote.trim(),
      clientId: d.client?.id ?? null,
    };
    const local: Record<string, string> = {};
    if (!body.title) local.title = 'Tarif adı gerekli';
    if (!d.category) local.category = 'Kategori seçin';
    if (!body.ingredients.length) local.ingredients = 'En az bir malzeme yazın (her satıra bir tane)';
    if (!body.steps.length) local.steps = 'En az bir adım yazın';
    setErr(local);
    if (Object.keys(local).length) {
      toast('Eksik alanları doldurun', 'error');
      return false;
    }

    setPending(true);
    try {
      let saved = editing
        ? (await api.patch<{ recipe: Recipe }>(`/recipes/${editing.id}`, body)).recipe
        : (
            await api.post<{ recipe: Recipe }>('/recipes', {
              ...body,
              parentId: base?.id ?? null,
              // Yeni fotoğraf seçilmediyse ve kaldırılmadıysa ana tarifin fotoğrafı kopyalanır
              copyImage: !!base?.imageBase && !file && !removeImage,
            })
          ).recipe;
      try {
        if (file) saved = (await api.upload<{ recipe: Recipe }>(`/recipes/${saved.id}/image`, file, {}, 'file')).recipe;
        else if (removeImage && saved.imageBase) saved = (await api.del<{ recipe: Recipe }>(`/recipes/${saved.id}/image`)).recipe;
      } catch (e) {
        await queryClient.invalidateQueries({ queryKey: ['recipes'] });
        onSaved(saved);
        toast(`Tarif kaydedildi ama fotoğraf yüklenemedi: ${errorMessage(e)}`, 'error');
        return true;
      }
      await queryClient.invalidateQueries({ queryKey: ['recipes'] });
      onSaved(saved);
      toast(editing ? 'Tarif güncellendi' : base ? 'Varyasyon oluşturuldu' : 'Tarif eklendi');
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        setErr(e.fields);
        toast(Object.values(e.fields)[0] ?? e.message, 'error');
      } else toast(`Kaydedilemedi: ${errorMessage(e)}`, 'error');
      return false;
    } finally {
      setPending(false);
    }
  };

  return {
    mode, d, err, pending, editing, base, isVariant, image,
    reset, startVariant, set, setClient, toggleDiet, setStep, moveStep, addStep, removeStep, pickImage, clearImage, save,
  };
}

export type RecipeForm = ReturnType<typeof useRecipeForm>;
