// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/lib/api';

/** Veri getirme: { data, error, loading, reload, setData } */
export function useApi<T>(fetcher: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const id = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const res = await fetcher();
      if (id === seq.current) setData(res);
    } catch (e) {
      if (id === seq.current) setError(e instanceof ApiError ? e : new ApiError(0, 'ERROR', 'Beklenmeyen bir hata oluştu'));
    } finally {
      if (id === seq.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, error, loading, reload: load, setData };
}

/** Form gönderimi / mutasyon: { run, pending, error, fieldErrors } */
export function useMutation<A extends unknown[], R>(fn: (...args: A) => Promise<R>) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const run = useCallback(
    async (...args: A): Promise<R | undefined> => {
      setPending(true);
      setError(null);
      try {
        return await fn(...args);
      } catch (e) {
        const err = e instanceof ApiError ? e : new ApiError(0, 'ERROR', 'Beklenmeyen bir hata oluştu');
        setError(err);
        throw err;
      } finally {
        setPending(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fn],
  );
  return { run, pending, error, fieldErrors: error?.fields ?? {}, reset: () => setError(null) };
}

export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
