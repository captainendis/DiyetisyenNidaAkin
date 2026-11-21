// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * API istemcisi — web'deki src/lib/api.ts ile aynı arayüz (get/post/put/patch/del/upload), böylece web ekranlarının
 * veri mantığı birebir taşınabilir. Farklar:
 *  - Cookie yok: "Authorization: Bearer <token>" + "X-App-Client: mobile" (sunucu: server/lib/http.ts → isMobileClient)
 *  - Durum değiştiren isteklerde X-CSRF-Token (giriş yanıtında / me ucunda döner)
 *  - download(): dosyayı önbelleğe indirir ve paylaşım sayfasını açar; printPdf(): sunucunun yazdırma
 *    sayfasını (HTML) cihazda PDF'e çevirip paylaşır
 *  - Panel (`api`) ve danışan (`portalApi`) ayrı oturumlardır; uygulamada aynı anda yalnızca biri açıktır.
 */
import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { API_URL } from './config';

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

export type Query = Record<string, string | number | boolean | null | undefined | string[]>;

/** Yükleme için dosya (expo-document-picker / expo-image-picker sonucundan) */
export interface UploadFile {
  uri: string;
  name: string;
  type: string;
}

function buildUrl(path: string, query?: Query) {
  let url = API_URL + (path.startsWith('/api') ? path : `/api${path}`);
  if (query) {
    const parts: string[] = [];
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === '') continue;
      if (Array.isArray(v)) v.forEach((x) => parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(x)}`));
      else parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
    }
    if (parts.length) url += (url.includes('?') ? '&' : '?') + parts.join('&');
  }
  return url;
}

function createClient(base = '', loginPath = '/auth/login') {
  let token: string | null = null;
  let csrfToken: string | null = null;
  let onUnauthorized: (() => void) | null = null;

  const authHeaders = (): Record<string, string> => ({
    'X-App-Client': 'mobile',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  });

  async function request<T>(method: string, path: string, body?: unknown, query?: Query): Promise<T> {
    const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
    const headers: Record<string, string> = { Accept: 'application/json', ...authHeaders() };
    if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';
    if (method !== 'GET' && csrfToken) headers['X-CSRF-Token'] = csrfToken;

    let res: Response;
    try {
      res = await fetch(buildUrl(base + path, query), {
        method,
        headers,
        credentials: 'omit',
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
      throw new ApiError(res.status, err.code ?? 'ERROR', err.message ?? 'İşlem tamamlanamadı', err.details?.fields ?? {}, err.details);
    }
    return data as T;
  }

  /** Ham metin (yazdırma sayfası HTML'i, CSV) */
  async function text(path: string, query?: Query): Promise<string> {
    let res: Response;
    try {
      res = await fetch(buildUrl(base + path, query), { headers: authHeaders(), credentials: 'omit' });
    } catch {
      throw new ApiError(0, 'NETWORK', 'Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.');
    }
    if (!res.ok) {
      if (res.status === 401 && onUnauthorized) onUnauthorized();
      const data = await res.json().catch(() => null);
      throw new ApiError(res.status, data?.error?.code ?? 'ERROR', data?.error?.message ?? 'İçerik alınamadı');
    }
    return res.text();
  }

  return {
    /** Oturum bilgisi (AuthProvider yönetir) */
    setSession: (t: string | null, csrf: string | null) => {
      token = t;
      csrfToken = csrf;
    },
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
    /** multipart/form-data — `fields` metin alanları, dosya "file" alanında (sunucu: readUpload) */
    upload: <T>(path: string, file: UploadFile, fields: Record<string, string> = {}, field = 'file') => {
      const form = new FormData();
      for (const [k, v] of Object.entries(fields)) form.append(k, v);
      // React Native FormData dosya nesnesi
      form.append(field, { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
      return request<T>('POST', path, form);
    },
    url: (path: string, query?: Query) => buildUrl(base + path, query),
    text,
    /** Dosyayı (yetkili istekle) indirir ve paylaşım/aç sayfasını gösterir */
    download: async (path: string, filename: string, query?: Query) => {
      const safe = filename.replace(/[\\/:*?"<>|]+/g, '_') || 'dosya';
      const dest = new File(Paths.cache, safe);
      if (dest.exists) dest.delete();
      let file: File;
      try {
        file = await File.downloadFileAsync(buildUrl(base + path, query), dest, { headers: authHeaders(), idempotent: true });
      } catch {
        throw new ApiError(0, 'DOWNLOAD', 'Dosya indirilemedi. Bağlantınızı kontrol edip tekrar deneyin.');
      }
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { dialogTitle: safe });
      return file.uri;
    },
    /** Sunucunun yazdırma sayfasını (A4 HTML) PDF'e çevirir ve paylaşır */
    printPdf: async (path: string, filename: string, query?: Query) => {
      const html = await text(path, query);
      // Göreli yollar (font, logo) API kökünden çözülsün
      const withBase = html.includes('<base ') ? html : html.replace(/<head([^>]*)>/i, `<head$1><base href="${API_URL}/">`);
      const { uri } = await Print.printToFileAsync({ html: withBase });
      const target = new File(Paths.cache, `${filename.replace(/[\\/:*?"<>|]+/g, '_')}.pdf`);
      if (target.exists) target.delete();
      new File(uri).move(target);
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(target.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
      return target.uri;
    },
    /** Görsel gibi yetkili kaynaklar için başlıklar (expo-image `source={{ uri, headers }}`) */
    headers: authHeaders,
  };
}

export type ApiClient = ReturnType<typeof createClient>;

/** Diyetisyen paneli + herkese açık uçlar (/api/...) */
export const api = createClient();
/** Danışan hesabı (/api/portal/...) */
export const portalApi = createClient('/portal');

/** Hata mesajı (her türlü hata için kullanıcıya gösterilebilir metin) */
export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error && e.message) return e.message;
  return 'Beklenmeyen bir hata oluştu';
}
