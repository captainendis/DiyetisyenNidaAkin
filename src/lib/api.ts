// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * API istemcisi
 *  - Cookie tabanlı oturum (credentials: same-origin)
 *  - Durum değiştiren isteklerde X-CSRF-Token başlığı (token /api/auth/me ile alınır)
 *  - Hatalar ApiError olarak fırlatılır; 422'de alan bazlı mesajlar `fields` içindedir
 *  - Panel (`api`) ve danışan hesabı (`portalApi`) ayrı istemcilerdir: ayrı CSRF token, ayrı oturum-düştü işleyicisi
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields: Record<string, string> = {},
    public details?: unknown,
  ) {
    super(message);
  }
}

type Query = Record<string, string | number | boolean | null | undefined | string[]>;

function buildUrl(path: string, query?: Query) {
  const url = new URL(path.startsWith('/api') ? path : `/api${path}`, window.location.origin);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === '') continue;
      if (Array.isArray(v)) v.forEach((x) => url.searchParams.append(k, x));
      else url.searchParams.set(k, String(v));
    }
  }
  return url.pathname + url.search;
}

/**
 * Bir API istemcisi oluşturur. Panel ve danışan hesabı (Hesabım) ayrı oturum + CSRF token kullandığı için
 * her biri kendi istemcisine sahiptir; aynı sekmede ikisi açık olsa da token'lar karışmaz.
 *  - base: yolların önüne eklenen önek (ör. "/portal")
 *  - loginPath: 401 yanıtında oturum-düştü işleyicisini tetiklemeyecek giriş ucu
 */
function createClient(base = '', loginPath = '/auth/login') {
  let csrfToken: string | null = null;
  let onUnauthorized: (() => void) | null = null;

  async function request<T>(method: string, path: string, body?: unknown, query?: Query): Promise<T> {
    const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';
    if (method !== 'GET' && csrfToken) headers['X-CSRF-Token'] = csrfToken;

    let res: Response;
    try {
      res = await fetch(buildUrl(base + path, query), {
        method,
        headers,
        credentials: 'same-origin',
        body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
      });
    } catch {
      throw new ApiError(0, 'NETWORK', 'Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.');
    }

    if (res.status === 204) return undefined as T;
    const ct = res.headers.get('content-type') ?? '';
    const data = ct.includes('application/json') ? await res.json().catch(() => null) : null;
    if (!res.ok) {
      const err = data?.error ?? {};
      if (res.status === 401 && onUnauthorized && !path.startsWith(loginPath)) onUnauthorized();
      throw new ApiError(
        res.status,
        err.code ?? 'ERROR',
        err.message ?? 'İşlem tamamlanamadı',
        err.details?.fields ?? {},
        err.details,
      );
    }
    return data as T;
  }

  return {
    setCsrfToken: (t: string | null) => {
      csrfToken = t;
    },
    setUnauthorizedHandler: (fn: (() => void) | null) => {
      onUnauthorized = fn;
    },
    get: <T>(path: string, query?: Query) => request<T>('GET', path, undefined, query),
    post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
    put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body ?? {}),
    patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body ?? {}),
    del: <T>(path: string) => request<T>('DELETE', path),
    upload: <T>(path: string, form: FormData) => request<T>('POST', path, form),
    /** URL üretir (ör. PDF'i yeni sekmede açmak için) */
    url: (path: string, query?: Query) => buildUrl(base + path, query),
    /** Dosya indirme (CSV, danışan dosyası) — tarayıcı indirmesini tetikler */
    download: (path: string, query?: Query) => {
      const a = document.createElement('a');
      a.href = buildUrl(base + path, query);
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
    },
  };
}

/** Panel ve herkese açık site */
export const api = createClient();
/** Danışan hesabı (Hesabım) — /api/portal */
export const portalApi = createClient('/portal');

/** Panel istemcisi için geriye dönük yardımcılar */
export const setCsrfToken = api.setCsrfToken;
/** Panel, oturum düştüğünde giriş sayfasına yönlendirmek için kayıt olur */
export const setUnauthorizedHandler = api.setUnauthorizedHandler;
