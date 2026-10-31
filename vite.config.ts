import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@shared': path.resolve(__dirname, 'shared'),
    },
  },
  server: {
    port: Number(process.env.WEB_PORT ?? 5173),
    proxy: Object.fromEntries(['/api', '/uploads', '/sitemap.xml', '/robots.txt'].map((p) => [p, `http://localhost:${process.env.API_PORT ?? 4000}`])),
  },
  build: {
    target: 'es2022',
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router'],
          motion: ['motion'],
        },
      },
    },
  },
});
