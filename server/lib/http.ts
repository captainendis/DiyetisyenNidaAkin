// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * HTTP katmanı (Hono): hata modeli, bağlam tipi ve istek yardımcıları.
 * API, Next.js içinde app/api/[[...path]]/route.ts üzerinden çalışır; testlerde aynı uygulama
 * @hono/node-server ile Node HTTP dinleyicisine çevrilir (server/app.ts → createApp).
 */
import { Hono, type Context } from 'hono';
import { ZodError, type ZodType, type z } from 'zod';
import type { AuthUser } from '../auth/session';
import type { PortalUser } from '../auth/client-session';
import { env } from './env';

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (message: string, details?: unknown) => new HttpError(400, 'BAD_REQUEST', message, details);
export const unauthorized = (message = 'Oturum açmanız gerekiyor') => new HttpError(401, 'UNAUTHORIZED', message);
export const forbidden = (message = 'Bu işlem için yetkiniz yok') => new HttpError(403, 'FORBIDDEN', message);
export const notFound = (message = 'Kayıt bulunamadı') => new HttpError(404, 'NOT_FOUND', message);
export const conflict = (code: string, message: string, details?: unknown) => new HttpError(409, code, message, details);

/** Gövdeyi Zod şemasıyla doğrular; hata alanlarını { field: mesaj } biçiminde döner */
export function parse<S extends ZodType>(schema: S, data: unknown): z.output<S> {
  const res = schema.safeParse(data);
  if (!res.success) throw validationError(res.error);
  return res.data;
}

export function validationError(err: ZodError) {
  const fields: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join('.') || '_';
    fields[key] ??= issue.message;
  }
  return new HttpError(422, 'VALIDATION_ERROR', 'Lütfen işaretli alanları kontrol edin', { fields });
}

// ───────────────────────── Bağlam ─────────────────────────

/** Node sunucusunda (testler) gelen istek; Next.js içinde yoktur */
interface NodeBindings {
  incoming?: { socket?: { remoteAddress?: string } };
}

export interface AppEnv {
  Bindings: NodeBindings;
  Variables: {
    /** Personel oturumu (loadSession) */
    user?: AuthUser;
    /** Danışan oturumu (loadClientSession) */
    portalUser?: PortalUser;
    /** JSON gövdesi bir kez okunur ve burada saklanır */
    jsonBody?: unknown;
  };
}
export type Ctx = Context<AppEnv>;

/** Yeni bir alt yönlendirici (Express'teki express.Router() karşılığı) */
export const router = () => new Hono<AppEnv>();

/** Yol parametresi (yoksa 404) */
export function param(c: Ctx, name = 'id'): string {
  const v = c.req.param(name);
  if (!v) throw notFound();
  return v;
}

/** Sorgu dizesi; tekrarlanan anahtarlar dizi olarak döner (Express req.query ile aynı biçim) */
export function query(c: Ctx): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const [k, vs] of Object.entries(c.req.queries())) out[k] = vs.length > 1 ? vs : vs[0]!;
  return out;
}

export const JSON_LIMIT_BYTES = 1024 * 1024;

/** JSON gövdesi (boşsa {}). Bozuk JSON → 400, 1 MB üstü → 413 */
export async function body(c: Ctx): Promise<unknown> {
  if (c.var.jsonBody !== undefined) return c.var.jsonBody;
  const len = Number(c.req.header('content-length') ?? 0);
  if (len > JSON_LIMIT_BYTES) throw new HttpError(413, 'PAYLOAD_TOO_LARGE', 'İstek çok büyük');
  const text = await c.req.text();
  if (text.length > JSON_LIMIT_BYTES) throw new HttpError(413, 'PAYLOAD_TOO_LARGE', 'İstek çok büyük');
  let data: unknown = {};
  if (text.trim()) {
    try {
      data = JSON.parse(text);
    } catch {
      throw badRequest('Geçersiz istek gövdesi');
    }
  }
  c.set('jsonBody', data);
  return data;
}

/**
 * İstemci IP'si. TRUST_PROXY = önümüzdeki güvenilir vekil sayısı (Express "trust proxy" ile aynı anlam).
 * Next.js, soket adresini X-Forwarded-For'un sonuna ekler; testlerde (Node sunucusu) soket adresi ayrıca eklenir.
 */
export function clientIp(c: Ctx): string | null {
  const chain = (c.req.header('x-forwarded-for') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const socket = c.env?.incoming?.socket?.remoteAddress;
  if (socket) chain.push(socket);
  if (!chain.length) return null;
  const hops = Math.min(env.TRUST_PROXY, chain.length - 1);
  return chain[chain.length - 1 - hops] ?? null;
}

export const userAgent = (c: Ctx) => c.req.header('user-agent')?.slice(0, 300) ?? null;

// ───────────────────────── Dosya yükleme / indirme ─────────────────────────

export interface UploadedFile {
  buffer: Buffer;
  /** Tarayıcının gönderdiği ad (UTF-8) */
  originalname: string;
  size: number;
}

/**
 * multipart/form-data içinden tek dosya okur (alan adı: "file"). Dosya yoksa null.
 * Boyut aşımında `tooLarge` hatası fırlatılır (Content-Length ile gövde okunmadan önce de denetlenir).
 */
export async function readUpload(c: Ctx, opts: { maxBytes: number; tooLarge: HttpError; field?: string }): Promise<UploadedFile | null> {
  const len = Number(c.req.header('content-length') ?? 0);
  // multipart sınırları için küçük bir pay
  if (len > opts.maxBytes + 64 * 1024) throw opts.tooLarge;
  let form: FormData;
  try {
    form = await c.req.formData();
  } catch {
    throw badRequest('Dosya yüklenemedi');
  }
  const f = form.get(opts.field ?? 'file');
  if (!f || typeof f === 'string') return null;
  if (f.size > opts.maxBytes) throw opts.tooLarge;
  return { buffer: Buffer.from(await f.arrayBuffer()), originalname: f.name, size: f.size };
}

/** İkili yanıt (dosya indirme, görsel) */
export function sendBuffer(_c: Ctx, buf: Buffer, headers: Record<string, string>, status = 200) {
  return new Response(new Uint8Array(buf), { status, headers: { 'Content-Length': String(buf.length), ...headers } });
}
