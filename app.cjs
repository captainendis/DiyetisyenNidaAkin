// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * cPanel "Setup Node.js App" (Phusion Passenger) başlangıç dosyası: Startup file = app.cjs
 * Passenger başlangıç dosyasını CommonJS olarak yükler; Next.js'in standalone sunucusu ise ES modülüdür.
 * Bu dosya onu dinamik import ile açar (Passenger, sunucunun dinlediği portu kendisi yönlendirir).
 */
import('./.next/standalone/server.js').catch((e) => {
  console.error('Sunucu başlatılamadı. Önce `npm run build` çalıştırıldı mı?', e);
  process.exit(1);
});
