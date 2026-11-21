// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * ../shared/*.ts dosyaları 'zod' ve 'luxon' içe aktarır. TypeScript bunları depo kökündeki node_modules'ta arar;
 * kökte bağımlılık kurulu değilse (ör. yalnızca mobile/ kurulmuşsa) bu bildirimler mobil paketlerine yönlendirir.
 * Çalışma zamanında Metro bu modülleri daima mobile/node_modules'tan çözer (metro.config.js).
 */
declare module 'luxon' {
  export * from '@mobile-deps/luxon';
}
declare module 'zod' {
  export * from '@mobile-deps/zod';
}
