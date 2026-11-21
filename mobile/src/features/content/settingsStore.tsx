// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Site ayarları düzenleyicisi (web: src/components/panel/content/settingsStore.tsx).
 * Tüm ayarlar tek seferde yüklenir (/content/settings). Bir ekran birden çok anahtarı (hero, intro, …) düzenler;
 * alttaki "Kaydet" değişen her anahtarı ayrı ayrı PUT /content/settings/:key ile kaydeder ve 422 alan hatalarını
 * (ör. "features.0", "steps.1.title") ilgili alana eşler.
 */
import { Stack } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { QueryView, Screen, useToast } from '@/components/ui';
import { api, ApiError, errorMessage } from '@/lib/api';
import { queryClient, useApiQuery } from '@/lib/query';
import type { Settings, SettingsKey } from '@shared/settings';
import { SaveBar, useUnsavedGuard, ViewOnSiteButton } from './FormBits';

export const SETTINGS_QK = ['content', 'settings'] as const;

export function useSiteSettings() {
  return useApiQuery(SETTINGS_QK, () => api.get<{ settings: Settings }>('/content/settings'));
}

const clone = <V,>(v: V): V => (v == null ? v : (JSON.parse(JSON.stringify(v)) as V));
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

type Drafts = Partial<Settings>;
type Errors = Partial<Record<SettingsKey, Record<string, string>>>;

interface Ctx {
  drafts: Drafts;
  errors: Errors;
  setDraft: <K extends SettingsKey>(key: K, fn: (d: Settings[K]) => void, clearField?: string) => void;
  replace: <K extends SettingsKey>(key: K, v: Settings[K]) => void;
}
const EditorCtx = createContext<Ctx | null>(null);

/** Form içinde tek bir ayar anahtarının taslağı */
export function useSettingField<K extends SettingsKey>(key: K) {
  const c = useContext(EditorCtx);
  if (!c) throw new Error('SettingsEditor gerekli');
  const d = c.drafts[key] as Settings[K];
  const errs: Record<string, string> = c.errors[key] ?? {};
  const { setDraft, replace } = c;
  /** Alanı ayarla ve o alanın hatasını temizle */
  const set = useCallback(
    <F extends keyof Settings[K]>(field: F, value: Settings[K][F]) => {
      setDraft(key, (x) => {
        x[field] = value;
      }, String(field));
    },
    [key, setDraft],
  );
  const update = useCallback((fn: (x: Settings[K]) => void, clearField?: string) => setDraft(key, fn, clearField), [key, setDraft]);
  const setAll = useCallback((v: Settings[K]) => replace(key, v), [key, replace]);
  return { d, set, update, setAll, err: (path: string) => errs[path] };
}

/**
 * Ayar düzenleme ekranı: yükler, taslakları tutar, altta kaydet çubuğu gösterir.
 * `validate`: kaydetmeden önce istemci kuralı (hata metni ya da null).
 */
export function SettingsEditor({
  title,
  keys,
  children,
  viewPath,
  validate,
  note,
  successMessage = 'Değişiklikler kaydedildi',
}: {
  title: string;
  keys: SettingsKey[];
  children: ReactNode;
  viewPath?: string;
  validate?: (drafts: Settings) => string | null;
  note?: string;
  successMessage?: string;
}) {
  const q = useSiteSettings();
  return (
    <>
      <Stack.Screen options={{ title, headerRight: viewPath ? () => <ViewOnSiteButton path={viewPath} /> : undefined }} />
      <QueryView query={q}>
        {(data) => (
          <EditorBody settings={data.settings} keys={keys} validate={validate} note={note} successMessage={successMessage} refreshing={q.refreshing} onRefresh={q.refresh}>
            {children}
          </EditorBody>
        )}
      </QueryView>
    </>
  );
}

function EditorBody({
  settings,
  keys,
  children,
  validate,
  note,
  successMessage,
  refreshing,
  onRefresh,
}: {
  settings: Settings;
  keys: SettingsKey[];
  children: ReactNode;
  validate?: (drafts: Settings) => string | null;
  note?: string;
  successMessage: string;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const toast = useToast();
  const pick = useCallback((s: Settings) => Object.fromEntries(keys.map((k) => [k, clone(s[k])])) as Drafts, [keys]);
  const [drafts, setDrafts] = useState<Drafts>(() => pick(settings));
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const dirtyKeys = keys.filter((k) => !same(drafts[k], settings[k]));
  const dirty = dirtyKeys.length > 0;
  useUnsavedGuard(dirty && !saving);

  // Sunucudaki değer değişirse (yenileme), değiştirilmemiş taslakları güncelle
  const prev = useRef(settings);
  useEffect(() => {
    const old = prev.current;
    if (old === settings) return;
    prev.current = settings;
    setDrafts((d) => {
      const next = { ...d };
      for (const k of keys) if (same(d[k], old[k])) (next as Record<string, unknown>)[k] = clone(settings[k]);
      return next;
    });
  }, [settings, keys]);

  const setDraft = useCallback(<K extends SettingsKey>(key: K, fn: (d: Settings[K]) => void, clearField?: string) => {
    setDrafts((d) => {
      const cur = d[key] as Settings[K] | undefined;
      if (cur === undefined) return d;
      const next = clone(cur);
      fn(next);
      return { ...d, [key]: next };
    });
    if (clearField) {
      setErrors((e) => {
        const ke = e[key];
        if (!ke?.[clearField]) return e;
        const { [clearField]: _drop, ...rest } = ke;
        return { ...e, [key]: rest };
      });
    }
  }, []);
  const replace = useCallback(<K extends SettingsKey>(key: K, v: Settings[K]) => setDrafts((d) => ({ ...d, [key]: v })), []);

  const save = async () => {
    const msg = validate?.({ ...settings, ...drafts } as Settings);
    if (msg) return toast(msg, 'error');
    setSaving(true);
    setErrors({});
    let ok = true;
    for (const k of dirtyKeys) {
      try {
        const res = await api.put<{ value: Settings[typeof k] }>(`/content/settings/${k}`, drafts[k]);
        queryClient.setQueryData<{ settings: Settings }>(SETTINGS_QK, (old) => (old ? { settings: { ...old.settings, [k]: res.value } } : old));
        setDrafts((d) => ({ ...d, [k]: clone(res.value) }));
        if (k === 'whatsappTemplates') {
          void queryClient.invalidateQueries({ queryKey: ['settings', 'whatsapp-templates'] });
          void queryClient.invalidateQueries({ queryKey: ['whatsapp-templates'] });
        }
      } catch (e) {
        ok = false;
        if (e instanceof ApiError && e.status === 422 && Object.keys(e.fields).length) {
          const fields = e.fields;
          setErrors((x) => ({ ...x, [k]: fields }));
          toast('Kaydedilemedi. İşaretli alanları kontrol edin.', 'error');
        } else toast(`Kaydedilemedi: ${errorMessage(e)}`, 'error');
      }
    }
    setSaving(false);
    if (ok) toast(successMessage);
  };

  const reset = () => {
    setDrafts(pick(settings));
    setErrors({});
  };

  const ctx = useMemo<Ctx>(() => ({ drafts, errors, setDraft, replace }), [drafts, errors, setDraft, replace]);
  return (
    <EditorCtx.Provider value={ctx}>
      <Screen refreshing={refreshing} onRefresh={dirty ? undefined : onRefresh} footer={<SaveBar dirty={dirty} saving={saving} onSave={() => void save()} onReset={reset} note={note} />}>
        {children}
      </Screen>
    </EditorCtx.Provider>
  );
}
