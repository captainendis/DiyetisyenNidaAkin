// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Ortam değişkenleri — uygulama açılışında doğrulanır. */
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  PUBLIC_SITE_URL: z.string().url().default('http://localhost:5173'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL gerekli'),
  DATA_ENCRYPTION_KEY: z
    .string()
    .min(1, 'DATA_ENCRYPTION_KEY gerekli (32 baytlık base64 anahtar)')
    .refine((v) => Buffer.from(v, 'base64').length === 32, 'DATA_ENCRYPTION_KEY 32 baytlık base64 olmalı'),
  SESSION_TTL_HOURS: z.coerce.number().min(1).max(72).default(12),
  SESSION_REMEMBER_DAYS: z.coerce.number().min(1).max(90).default(30),
  TRUST_PROXY: z.coerce.number().default(0),
  UPLOAD_DIR: z.string().default('./storage'),
  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: z.string().optional().default('false').transform((v) => v === 'true'),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  MAIL_FROM: z.string().optional().default(''),
  /** PDF üretimi için Chromium yolu (boşsa Playwright'ın kurulu tarayıcısı aranır) */
  CHROMIUM_PATH: z.string().optional().default(''),
  DEMO_MODE: z.string().optional().default('false').transform((v) => v === 'true'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('✖ Ortam değişkenleri geçersiz:');
  for (const issue of parsed.error.issues) console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  isProd: parsed.data.NODE_ENV === 'production',
  publicSiteUrl: parsed.data.PUBLIC_SITE_URL.replace(/\/$/, ''),
};
