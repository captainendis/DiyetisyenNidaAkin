// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Kriptografi yardımcıları
 *  - Parola: scrypt (N=2^15, r=8, p=1) + rastgele tuz, sabit zamanlı karşılaştırma
 *  - Token: 32 bayt rastgele, veritabanında yalnızca SHA-256 özeti tutulur
 *  - Alan şifreleme: AES-256-GCM (klinik notlar, ölçümler, danışan dosyaları)
 */
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { env } from './env';

const scrypt = promisify(crypto.scrypt) as (pw: string, salt: Buffer, len: number, opts: crypto.ScryptOptions) => Promise<Buffer>;
const SCRYPT = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password.normalize('NFKC'), salt, 64, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, n, r, p, saltB64, keyB64] = stored.split('$');
  if (algo !== 'scrypt') return false;
  const expected = Buffer.from(keyB64, 'base64');
  const key = await scrypt(password.normalize('NFKC'), Buffer.from(saltB64, 'base64'), expected.length, {
    N: Number(n), r: Number(r), p: Number(p), maxmem: SCRYPT.maxmem,
  });
  return key.length === expected.length && crypto.timingSafeEqual(key, expected);
}

/** Zamanlama saldırılarına karşı: kullanıcı bulunamadığında da aynı maliyette doğrulama yap */
let dummyHash: string | null = null;
export async function burnPasswordCheck(password: string) {
  dummyHash ??= await hashPassword('timing-equalizer-0000');
  await verifyPassword(password, dummyHash);
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

const KEY = Buffer.from(env.DATA_ENCRYPTION_KEY, 'base64');
const VERSION = 'v1';

export function encryptString(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION}:${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

export function decryptString(payload: string): string {
  const [version, ivB64, tagB64, dataB64] = payload.split(':');
  if (version !== VERSION) throw new Error('Desteklenmeyen şifreleme sürümü');
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
}

export function encryptJson(value: unknown): string {
  return encryptString(JSON.stringify(value));
}
export function decryptJson<T>(payload: string): T {
  return JSON.parse(decryptString(payload)) as T;
}

/** Dosya içeriği şifreleme: [12 bayt IV][16 bayt TAG][veri] */
export function encryptBuffer(buf: Buffer): Buffer {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const enc = Buffer.concat([cipher.update(buf), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]);
}
export function decryptBuffer(buf: Buffer): Buffer {
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]);
}
