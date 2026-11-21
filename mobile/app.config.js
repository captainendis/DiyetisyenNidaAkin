// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Dinamik yapılandırma — temel ayarlar app.json'da; burada yalnızca derleme ortamından gelenler eklenir:
 *  - BUILD_NUMBER: mağaza derleme numarası (Android versionCode / iOS buildNumber). GitHub Actions'ta çalıştırma
 *    numarasından üretilir; her yükleme bir öncekinden büyük olmalıdır.
 *  - GOOGLE_SERVICES_JSON_PATH: Firebase (FCM) yapılandırma dosyası — Android'de anlık bildirim için gerekir.
 *  - EAS_PROJECT_ID: Expo push servisinin proje kimliği (app.json'da extra.eas.projectId yoksa).
 *  - Android sürüm imzası: plugins/withAndroidReleaseSigning.js
 */
const fs = require('node:fs');

module.exports = ({ config }) => {
  const build = Number(process.env.BUILD_NUMBER) || undefined;
  const gsf = process.env.GOOGLE_SERVICES_JSON_PATH;
  const projectId = config.extra?.eas?.projectId || process.env.EAS_PROJECT_ID || undefined;
  return {
    ...config,
    android: {
      ...config.android,
      ...(build ? { versionCode: build } : {}),
      ...(gsf && fs.existsSync(gsf) ? { googleServicesFile: gsf } : {}),
    },
    ios: {
      ...config.ios,
      ...(build ? { buildNumber: String(build) } : {}),
    },
    extra: {
      ...config.extra,
      ...(projectId ? { eas: { ...config.extra?.eas, projectId } } : {}),
    },
    plugins: [...(config.plugins ?? []), './plugins/withAndroidReleaseSigning'],
  };
};
