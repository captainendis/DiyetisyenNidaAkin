// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../generated/prisma/client';
import { env } from './env';

// MySQL 8 / MariaDB 10.6+ — DATABASE_URL: mysql://kullanici:sifre@sunucu:3306/veritabani
const adapter = new PrismaMariaDb(env.DATABASE_URL);
export const prisma = new PrismaClient({ adapter });
export type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
export * from '../generated/prisma/client';
