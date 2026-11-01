// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { config } from 'dotenv';

config({ path: path.resolve(import.meta.dirname, '.env') });

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@shared': path.resolve(import.meta.dirname, 'shared'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Entegrasyon testleri aynı veritabanını kullanır — sıralı çalıştır
    fileParallelism: false,
  },
});
