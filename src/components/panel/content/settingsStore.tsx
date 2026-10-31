/**
 * Site ayarları için ortak form deposu.
 * Tüm ayarlar tek seferde yüklenir; her anahtar (hero, about, contact…) bağımsız bir form olarak düzenlenir,
 * kaydedilir ve 422 alan hataları (ör. "features.0") ilgili alana eşlenir.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import { useFeedback } from '@/components/panel/ui';
import type { Settings, SettingsKey } from '@shared/settings';

interface StoreCtx {
  settings: Settings | null;
  loading: boolean;
  error: ApiError | null;
  reload: () => void;
  commit: <K extends SettingsKey>(key: K, value: Settings[K]) => void;
  setDirty: (key: SettingsKey, dirty: boolean) => void;
  dirtyKeys: SettingsKey[];
}

const Ctx = createContext<StoreCtx | null>(null);

export function SettingsStoreProvider({ children }: { children: ReactNode }) {
  const { data, loading, error, reload, setData } = useApi(() => api.get<{ settings: Settings }>('/content/settings'), []);
  const [dirty, setDirtyMap] = useState<Partial<Record<SettingsKey, boolean>>>({});
  const commit = useCallback(<K extends SettingsKey>(key: K, value: Settings[K]) => {
    setData((d) => (d ? { settings: { ...d.settings, [key]: value } } : d));
  }, [setData]);
  const setDirty = useCallback((key: SettingsKey, v: boolean) => setDirtyMap((m) => (m[key] === v ? m : { ...m, [key]: v })), []);
  const dirtyKeys = useMemo(() => (Object.keys(dirty) as SettingsKey[]).filter((k) => dirty[k]), [dirty]);

  // Kaydedilmemiş değişiklik varken sayfadan ayrılma uyarısı
  useEffect(() => {
    if (!dirtyKeys.length) return;
    const on = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', on);
    return () => window.removeEventListener('beforeunload', on);
  }, [dirtyKeys.length]);

  return (
    <Ctx.Provider value={{ settings: data?.settings ?? null, loading, error, reload, commit, setDirty, dirtyKeys }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSettingsStore() {
  const c = useContext(Ctx);
  if (!c) throw new Error('SettingsStoreProvider gerekli');
  return c;
}

const clone = <T,>(v: T): T => (v == null ? v : (JSON.parse(JSON.stringify(v)) as T));

/** Tek bir ayar anahtarı için form durumu */
export function useSettingForm<K extends SettingsKey>(key: K, opts: { successMessage?: string } = {}) {
  const store = useSettingsStore();
  const fb = useFeedback();
  const saved = store.settings?.[key] ?? null;
  const [draft, setDraft] = useState<Settings[K] | null>(() => clone(saved));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(clone(saved));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved]);

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved]);
  const { setDirty } = store;
  useEffect(() => setDirty(key, dirty), [dirty, key, setDirty]);
  useEffect(() => () => setDirty(key, false), [key, setDirty]);

  const update = useCallback((fn: (d: Settings[K]) => void) => {
    setDraft((d) => {
      if (!d) return d;
      const next = clone(d);
      fn(next);
      return next;
    });
  }, []);

  /** Belirli bir alanı ayarla ve o alanın hatasını temizle */
  const set = useCallback(<F extends keyof Settings[K]>(field: F, value: Settings[K][F]) => {
    update((d) => {
      d[field] = value;
    });
    setErrors((e) => {
      if (!e[field as string]) return e;
      const { [field as string]: _drop, ...rest } = e;
      return rest;
    });
  }, [update]);

  const save = useCallback(async () => {
    if (!draft) return false;
    setSaving(true);
    setErrors({});
    try {
      const res = await api.put<{ value: Settings[K] }>(`/content/settings/${key}`, draft);
      store.commit(key, res.value);
      fb.success(opts.successMessage ?? 'Değişiklikler kaydedildi', 'Web sitesinde hemen görünür.');
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        setErrors(e.fields);
        fb.error('Kaydedilemedi', 'İşaretli alanları kontrol edin.');
      } else fb.error('Kaydedilemedi', e instanceof ApiError ? e.message : undefined);
      return false;
    } finally {
      setSaving(false);
    }
  }, [draft, key, store, fb, opts.successMessage]);

  const reset = useCallback(() => {
    setDraft(clone(saved));
    setErrors({});
  }, [saved]);

  return { draft, set, update, save, reset, dirty, saving, errors };
}
