// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Tarif ekle / düzenle. Fotoğraf seçilince yerelde önizlenir; tarif kaydedildikten sonra yüklenir
 * (yeni tarifte önce kayıt oluşur, ardından fotoğraf ona bağlanır).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ImagePlus, Plus, Trash2, X } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Button, Input, Modal, Select, Textarea, useFeedback } from '@/components/panel/ui';
import { cn } from '@/lib/format';
import {
  RECIPE_CATEGORIES, RECIPE_CATEGORY_LABEL, recipeImageUrl, type Recipe, type RecipeCategory, type RecipeInput,
} from '@shared/recipe';

const MAX_UPLOAD = 15 * 1024 * 1024;

interface Draft {
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
}

const toDraft = (r?: Recipe | null, category?: RecipeCategory): Draft => ({
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
});

const num = (v: string) => {
  const n = Number(v.replace(',', '.'));
  return v.trim() && Number.isFinite(n) ? Math.round(n) : null;
};

export function RecipeFormModal({
  open, onClose, recipe, defaultCategory, onSaved, onDeleted,
}: {
  open: boolean;
  onClose: () => void;
  recipe?: Recipe | null;
  defaultCategory?: RecipeCategory;
  onSaved: (r: Recipe) => void;
  onDeleted?: (id: string) => void;
}) {
  const fb = useFeedback();
  const [d, setD] = useState<Draft>(() => toDraft(recipe, defaultCategory));
  const [err, setErr] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setD(toDraft(recipe, defaultCategory));
    setErr({});
    setFile(null);
    setRemoveImage(false);
  }, [open, recipe, defaultCategory]);

  const localUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (localUrl) URL.revokeObjectURL(localUrl); }, [localUrl]);
  const shownImage = localUrl ?? (!removeImage && recipe?.imageBase ? recipeImageUrl(recipe.imageBase, 960) : null);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));
  const setStep = (i: number, v: string) => setD((p) => ({ ...p, steps: p.steps.map((s, j) => (j === i ? v : s)) }));
  const moveStep = (i: number, to: number) =>
    setD((p) => {
      const steps = [...p.steps];
      steps.splice(to, 0, steps.splice(i, 1)[0]!);
      return { ...p, steps };
    });

  const pick = (f: File | undefined) => {
    if (!f) return;
    if (f.size > MAX_UPLOAD) return fb.error('Fotoğraf çok büyük', 'En fazla 15 MB yükleyebilirsiniz.');
    setFile(f);
    setRemoveImage(false);
    if (input.current) input.current.value = '';
  };

  const save = async () => {
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
    };
    const local: Record<string, string> = {};
    if (!body.title) local.title = 'Tarif adı gerekli';
    if (!d.category) local.category = 'Kategori seçin';
    if (!body.ingredients.length) local.ingredients = 'En az bir malzeme yazın (her satıra bir tane)';
    if (!body.steps.length) local.steps = 'En az bir adım yazın';
    setErr(local);
    if (Object.keys(local).length) return;

    setPending(true);
    try {
      let saved = recipe
        ? (await api.patch<{ recipe: Recipe }>(`/recipes/${recipe.id}`, body)).recipe
        : (await api.post<{ recipe: Recipe }>('/recipes', body)).recipe;
      try {
        if (file) {
          const form = new FormData();
          form.append('file', file);
          saved = (await api.upload<{ recipe: Recipe }>(`/recipes/${saved.id}/image`, form)).recipe;
        } else if (removeImage && saved.imageBase) {
          saved = (await api.del<{ recipe: Recipe }>(`/recipes/${saved.id}/image`)).recipe;
        }
      } catch (e) {
        onSaved(saved);
        fb.error('Tarif kaydedildi ama fotoğraf yüklenemedi', e instanceof ApiError ? e.message : undefined);
        return onClose();
      }
      onSaved(saved);
      fb.success(recipe ? 'Tarif güncellendi' : 'Tarif eklendi');
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) setErr(e.fields);
      else fb.error('Kaydedilemedi', e instanceof ApiError ? e.message : undefined);
    } finally {
      setPending(false);
    }
  };

  const remove = async () => {
    if (!recipe) return;
    const ok = await fb.confirm({
      title: 'Tarif silinsin mi?',
      description: 'Bu tarifi ek sayfasında kullanan planlardan da kaldırılır. İşlem geri alınamaz.',
      confirmLabel: 'Sil',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await api.del(`/recipes/${recipe.id}`);
      onDeleted?.(recipe.id);
      fb.success('Tarif silindi');
      onClose();
    } catch (e) {
      fb.error('Silinemedi', e instanceof ApiError ? e.message : undefined);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      closeOnBackdrop={false}
      title={recipe ? 'Tarifi düzenle' : 'Yeni tarif'}
      description="Tarifler beslenme planlarının arkasına ek sayfa olarak eklenebilir."
      footer={
        <>
          {recipe && onDeleted && (
            <Button variant="ghost" className="mr-auto" icon={<Trash2 className="h-4 w-4" />} onClick={() => void remove()}>
              Sil
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>Vazgeç</Button>
          <Button loading={pending} onClick={() => void save()}>{recipe ? 'Kaydet' : 'Tarifi ekle'}</Button>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        {/* Sol: fotoğraf ve künye */}
        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-[0.8rem] font-semibold text-cocoa">Fotoğraf</p>
            <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-dashed border-panel-line bg-panel-bg">
              {shownImage ? (
                <img src={shownImage} alt="" className="h-full w-full object-cover" />
              ) : (
                <button type="button" onClick={() => input.current?.click()} className="flex h-full w-full flex-col items-center justify-center gap-2 text-panel-muted hover:text-cocoa">
                  <ImagePlus className="h-7 w-7" />
                  <span className="text-[0.82rem] font-semibold">Fotoğraf seçin</span>
                  <span className="text-[0.72rem]">JPG, PNG, WebP veya AVIF · en fazla 15 MB</span>
                </button>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" icon={<ImagePlus className="h-4 w-4" />} onClick={() => input.current?.click()}>
                {shownImage ? 'Değiştir' : 'Yükle'}
              </Button>
              {shownImage && (
                <Button variant="ghost" size="sm" icon={<X className="h-4 w-4" />} onClick={() => { setFile(null); setRemoveImage(true); }}>
                  Kaldır
                </Button>
              )}
              <span className="text-[0.72rem] text-panel-muted">4:3 kırpılır; konum ve cihaz bilgisi silinir.</span>
            </div>
            <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" tabIndex={-1} onChange={(e) => pick(e.target.files?.[0])} />
          </div>
          <Input label="Tarif adı" required value={d.title} maxLength={80} error={err.title} placeholder="Yulaflı tost" onChange={(e) => set('title', e.target.value)} />
          <Select
            label="Kategori"
            required
            value={d.category}
            error={err.category}
            placeholder="Seçin"
            options={RECIPE_CATEGORIES.map((c) => ({ value: c, label: RECIPE_CATEGORY_LABEL[c] }))}
            onChange={(e) => set('category', e.target.value as RecipeCategory)}
          />
          <Textarea label="Kısa açıklama" rows={2} value={d.summary} maxLength={200} error={err.summary} placeholder="Tok tutan, 10 dakikada hazır bir kahvaltı." onChange={(e) => set('summary', e.target.value)} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2">
            <Input label="Porsiyon" inputMode="numeric" value={d.servings} error={err.servings} placeholder="1" onChange={(e) => set('servings', e.target.value.replace(/\D/g, '').slice(0, 2))} />
            <Input label="Kalori (porsiyon)" inputMode="numeric" value={d.kcal} error={err.kcal} placeholder="kcal" onChange={(e) => set('kcal', e.target.value.replace(/\D/g, '').slice(0, 4))} />
            <Input label="Hazırlık (dk)" inputMode="numeric" value={d.prepMinutes} error={err.prepMinutes} placeholder="10" onChange={(e) => set('prepMinutes', e.target.value.replace(/\D/g, '').slice(0, 4))} />
            <Input label="Pişirme (dk)" inputMode="numeric" value={d.cookMinutes} error={err.cookMinutes} placeholder="15" onChange={(e) => set('cookMinutes', e.target.value.replace(/\D/g, '').slice(0, 4))} />
          </div>
        </div>

        {/* Sağ: malzemeler ve yapılış */}
        <div className="space-y-4">
          <Textarea
            label="Malzemeler"
            required
            rows={8}
            value={d.ingredients}
            error={err.ingredients}
            hint="Her satıra bir malzeme ve miktarı."
            placeholder={'4 yemek kaşığı yulaf\n1 yumurta\n2 dilim beyaz peynir'}
            className="text-[0.85rem]"
            onChange={(e) => set('ingredients', e.target.value)}
          />
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-[0.8rem] font-semibold text-cocoa">Hazırlanışı<span className="ml-0.5 text-danger" aria-hidden>*</span></p>
              {d.steps.length < 15 && (
                <Button variant="ghost" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => set('steps', [...d.steps, ''])}>Adım ekle</Button>
              )}
            </div>
            <ol className="space-y-2">
              {d.steps.map((s, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-2 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-cocoa/40 text-[0.72rem] font-bold text-cocoa tabular">{i + 1}</span>
                  <Textarea aria-label={`${i + 1}. adım`} rows={2} value={s} maxLength={500} wrapperClassName="min-w-0 flex-1" className="text-[0.85rem]" onChange={(e) => setStep(i, e.target.value)} />
                  <div className="flex flex-col">
                    <Button variant="ghost" size="sm" aria-label="Yukarı taşı" disabled={i === 0} onClick={() => moveStep(i, i - 1)}><ArrowUp className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="sm" aria-label="Aşağı taşı" disabled={i === d.steps.length - 1} onClick={() => moveStep(i, i + 1)}><ArrowDown className="h-3.5 w-3.5" /></Button>
                  </div>
                  <Button variant="ghost" size="sm" className="mt-1" aria-label="Adımı sil" disabled={d.steps.length === 1} onClick={() => set('steps', d.steps.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                </li>
              ))}
            </ol>
            {err.steps && <p className={cn('mt-1.5 text-[0.78rem] text-danger')} role="alert">{err.steps}</p>}
          </div>
          <Textarea label="İpucu (isteğe bağlı)" rows={2} value={d.tip} maxLength={300} error={err.tip} placeholder="Akşamdan hazırlayıp buzdolabında saklayabilirsin." onChange={(e) => set('tip', e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}
