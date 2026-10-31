/** HTTP hata modeli ve yardımcıları */
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError, type ZodType, type z } from 'zod';

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

/** Express 5 async hataları zaten yakalar; bu sarmalayıcı tip kolaylığı içindir */
export const handler = (fn: (req: Request, res: Response, next: NextFunction) => unknown): RequestHandler =>
  (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function clientIp(req: Request): string | null {
  return req.ip ?? null;
}
