// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import Constants from 'expo-constants';

/**
 * API kök adresi. Sıra: EXPO_PUBLIC_API_URL (geliştirme: `EXPO_PUBLIC_API_URL=http://192.168.1.20:3000 npx expo start`)
 * → app.json "extra.apiUrl" (üretim). Sonunda "/" olmadan.
 */
export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL ||
  (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ||
  'https://nidaakin.com'
).replace(/\/+$/, '');

/** Web sitesindeki sayfalar (KVKK metni, blog önizleme vb.) için */
export const SITE_URL = API_URL;
