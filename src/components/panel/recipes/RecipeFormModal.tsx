// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Tarif ekle / düzenle / varyasyon oluştur.
 *  - Fotoğraf seçilince yerelde önizlenir; tarif kaydedildikten sonra yüklenir.
 *  - Varyasyon: ana tarifin kopyasıyla başlar (fotoğraf sunucuda kopyalanır); bir danışana bağlanabilir.
 *  - "Web sitesinde yayınla": yalnızca danışana bağlı olmayan tarifler için.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ExternalLink, GitBranch, ImagePlus, Plus, Trash2, X } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Button, Checkbox, Input, Modal, Select, Switch, Textarea, useFeedback } from '@/components/panel/ui';
import { ClientPicker, type ClientRef } from './ClientPicker';
import { cn } from '@/lib/format';
import {
  DIET_TAGS, DIET_TAG_LABEL, DIET_TAG_NOTE, MAX_FEATURED_RECIPES, RECIPE_CATEGORIES, RECIPE_CATEGORY_LABEL, normalizeDietTags, recipeImageUrl, type DietTag, type Recipe, type RecipeCategory, type RecipeInput,
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
  dietTags: DietTag[];
  isPublished: boolean;
  isFeatured: boolean;
  variantNote: string;
  client: ClientRef | null;
}

const toDraft = (r?: Recipe | null, category?: RecipeCategory): Draft => ({
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

const num = (v: string) => {
  const n = Number(v.replace(',', '.'));
  return v.trim() && Number.isFinite(n) ? Math.round(n) : null;
};

type Mode = { kind: 'new' } | { kind: 'edit'; recipe: Recipe } | { kind: 'variant'; base: Recipe };

/** Varyasyon taslağı: ana tarifin içeriği, yayın kapalı, isteğe bağlı danışan */
const variantDraft = (base: Recipe, client: ClientRef | null): Draft => ({
  ...toDraft(base),
  isPublished: false,
  isFeatured: false,
  variantNote: '',
  client,
});

export function RecipeFormModal({
  open, onClose, recipe, variantOf, defaultClient = null, defaultCategory, onSaved, onDeleted,
}: {
  open: boolean;
  onClose: () => void;
  recipe?: Recipe | null;
  /** Verilirse bu tarifin varyasyonu oluşturulur */
  variantOf?: Recipe | null;
  /** Varyasyon için önceden seçili danışan (ör. plan düzenleyiciden) */
  defaultClient?: ClientRef | null;
  defaultCategory?: RecipeCategory;
  onSaved: (r: Recipe) => void;
  onDeleted?: (id: string) => void;
}) {
  const fb = useFeedback();
  const initialMode = (): Mode => (variantOf ? { kind: 'variant', base: variantOf } : recipe ? { kind: 'edit', recipe } : { kind: 'new' });
  const [mode, setMode] = useState<Mode>(initialMode);
  const [d, setD] = useState<Draft>(() => (variantOf ? variantDraft(variantOf, defaultClient) : toDraft(recipe, defaultCategory)));
  const [err, setErr] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setMode(initialMode());
    setD(variantOf ? variantDraft(variantOf, defaultClient) : toDraft(recipe, defaultCategory));
    setErr({});
    setFile(null);
    setRemoveImage(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, recipe, variantOf, defaultClient, defaultCategory]);

  const editing = mode.kind === 'edit' ? mode.recipe : null;
  const base = mode.kind === 'variant' ? mode.base : null;
  const imageOwner = editing ?? base;
  const isVariant = !!base || !!editing?.parentId || !!d.client || !!d.variantNote;

  const localUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (localUrl) URL.revokeObjectURL(localUrl); }, [localUrl]);
  const shownImage = localUrl ?? (!removeImage && imageOwner?.imageBase ? recipeImageUrl(imageOwner.imageBase, 960) : null);

  const startVariant = () => {
    if (!editing) return;
    setMode({ kind: 'variant', base: editing });
    setD(variantDraft(editing, defaultClient));
    setErr({});
    setFile(null);
    setRemoveImage(false);
  };

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));
  // Vegan işaretlenince vejetaryen de işaretlenir; vejetaryen, vegan açıkken kapatılamaz
  const toggleDiet = (t: DietTag, on: boolean) =>
    setD((p) => ({ ...p, dietTags: normalizeDietTags(on ? [...p.dietTags, t] : p.dietTags.filter((x) => x !== t)) }));
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
    if (Object.keys(local).length) return;

    setPending(true);
    try {
      let saved = editing
        ? (await api.patch<{ recipe: Recipe }>(`/recipes/${editing.id}`, body)).recipe
        : (await api.post<{ recipe: Recipe }>('/recipes', {
            ...body,
            parentId: base?.id ?? null,
            // Yeni fotoğraf seçilmediyse ve kaldırılmadıysa ana tarifin fotoğrafı kopyalanır
            copyImage: !!base?.imageBase && !file && !removeImage,
          })).recipe;
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
      fb.success(editing ? 'Tarif güncellendi' : base ? 'Varyasyon oluşturuldu' : 'Tarif eklendi');
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) setErr(e.fields);
      else fb.error('Kaydedilemedi', e instanceof ApiError ? e.message : undefined);
    } finally {
      setPending(false);
    }
  };

  const remove = async () => {
    const recipe = editing;
    if (!recipe) return;
    const ok = await fb.confirm({
      title: 'Tarif silinsin mi?',
      description: `Bu tarifi ek sayfasında kullanan planlardan da kaldırılır${recipe.isPublished ? ' ve web sitesinden kalkar' : ''}.${recipe.variantCount ? ` ${recipe.variantCount} varyasyonu bağımsız tarif olarak kalır.` : ''} İşlem geri alınamaz.`,
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
      title={editing ? 'Tarifi düzenle' : base ? 'Varyasyon oluştur' : 'Yeni tarif'}
      description={
        base
          ? `“${base.title}” tarifinden başlar. Değiştirdiğiniz yerler yalnızca bu varyasyona uygulanır; ana tarif aynı kalır.`
          : 'Tarifler beslenme planlarının arkasına ek sayfa olarak eklenebilir.'
      }
      footer={
        <>
          {editing && onDeleted && (
            <Button variant="ghost" icon={<Trash2 className="h-4 w-4" />} onClick={() => void remove()}>
              Sil
            </Button>
          )}
          {editing && (
            <Button variant="ghost" className="mr-auto" icon={<GitBranch className="h-4 w-4" />} onClick={startVariant}>
              Varyasyon oluştur
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>Vazgeç</Button>
          <Button loading={pending} onClick={() => void save()}>{editing ? 'Kaydet' : base ? 'Varyasyonu kaydet' : 'Tarifi ekle'}</Button>
        </>
      }
    >
      {editing && (editing.parent || editing.variantCount > 0) && (
        <p className="mb-5 rounded-lg bg-panel-bg px-3.5 py-2.5 text-[0.8rem] text-cocoa">
          {editing.parent ? <>Bu tarif <b>“{editing.parent.title}”</b> tarifinin varyasyonudur. </> : null}
          {editing.variantCount > 0 ? <>Bu tarifin <b>{editing.variantCount} varyasyonu</b> var; buradaki değişiklikler onları etkilemez.</> : null}
        </p>
      )}
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
          {isVariant && (
            <div className="space-y-4 rounded-xl border border-panel-line bg-panel-bg/40 p-3.5">
              <Input
                label="Varyasyon notu"
                value={d.variantNote}
                maxLength={120}
                error={err.variantNote}
                placeholder="Laktozsuz, glutensiz ekmekle"
                hint="Neyin değiştiğini kısaca yazın; PDF'te tarif adının altında görünür."
                onChange={(e) => set('variantNote', e.target.value)}
              />
              <ClientPicker
                label="Kişiye özel (isteğe bağlı)"
                value={d.client}
                onChange={(c) => setD((p) => ({ ...p, client: c, isPublished: c ? false : p.isPublished }))}
                hint={d.client ? 'Yalnızca bu danışanın planlarında önerilir, PDF’te “Sana özel” olarak basılır. Danışan silinirse bu tarif de silinir.' : 'Boş bırakılırsa genel bir varyasyon olur (ör. vegan versiyon).'}
              />
            </div>
          )}
          <div className="rounded-xl border border-panel-line p-3.5">
            <Switch
              label="Web sitesinde yayınla"
              description={
                d.client
                  ? 'Kişiye özel tarifler yayınlanamaz.'
                  : d.isPublished
                    ? 'Sitedeki “Tarifler” bölümünde herkes görebilir.'
                    : 'Kapalıyken yalnızca panelde ve planlarda kullanılır.'
              }
              checked={!d.client && d.isPublished}
              disabled={!!d.client}
              onChange={(v) => set('isPublished', v)}
            />
            {err.isPublished && <p className="mt-1.5 text-[0.78rem] text-danger-ink" role="alert">{err.isPublished}</p>}
            {!d.client && d.isPublished && (
              <div className="mt-3 border-t border-panel-line pt-3">
                <Switch
                  label="Ana sayfada göster"
                  description={`Ana sayfadaki “Mutfaktan” bölümünde öne çıkar (en fazla ${MAX_FEATURED_RECIPES} tarif).`}
                  checked={d.isFeatured}
                  onChange={(v) => set('isFeatured', v)}
                />
                {err.isFeatured && <p className="mt-1.5 text-[0.78rem] text-danger-ink" role="alert">{err.isFeatured}</p>}
              </div>
            )}
            {editing?.isPublished && editing.slug && d.isPublished && (
              <a href={`/tarifler/${editing.slug}`} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[0.78rem] font-semibold text-cocoa hover:underline">
                Sitede görüntüle <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
          <fieldset className="rounded-md border border-panel-line p-4">
            <legend className="px-1 text-[0.8rem] font-semibold text-cocoa">Diyet türü</legend>
            <div className="space-y-3">
              {DIET_TAGS.map((t) => (
                <Checkbox
                  key={t}
                  label={DIET_TAG_LABEL[t]}
                  description={DIET_TAG_NOTE[t]}
                  checked={d.dietTags.includes(t)}
                  disabled={t === 'VEGETARIAN' && d.dietTags.includes('VEGAN')}
                  onChange={(e) => toggleDiet(t, e.target.checked)}
                />
              ))}
            </div>
          </fieldset>
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
              <p className="text-[0.8rem] font-semibold text-cocoa">Hazırlanışı<span className="ml-0.5 text-danger-ink" aria-hidden>*</span></p>
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
            {err.steps && <p className={cn('mt-1.5 text-[0.78rem] text-danger-ink')} role="alert">{err.steps}</p>}
          </div>
          <Textarea label="İpucu (isteğe bağlı)" rows={2} value={d.tip} maxLength={300} error={err.tip} placeholder="Akşamdan hazırlayıp buzdolabında saklayabilirsin." onChange={(e) => set('tip', e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}
