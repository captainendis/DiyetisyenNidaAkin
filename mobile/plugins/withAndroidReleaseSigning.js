// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Android sürüm imzası (GitHub Actions derlemesi için).
 * `android/` klasörü her derlemede `expo prebuild` ile yeniden üretilir (depoya girmez); bu eklenti üretilen
 * app/build.gradle'a "release" imza yapılandırmasını ekler. Anahtar bilgileri ortam değişkenlerinden okunur:
 *   ANDROID_KEYSTORE_PATH, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS, ANDROID_KEY_PASSWORD
 * Değişkenler yoksa (yerel geliştirme, PR derlemesi) Expo'nun varsayılanı (debug imzası) korunur.
 */
const { withAppBuildGradle } = require('@expo/config-plugins');

const MARK = '// nidaakin-release-signing';

const SIGNING = `
    ${MARK}
    if (System.getenv("ANDROID_KEYSTORE_PATH")) {
        release {
            storeFile file(System.getenv("ANDROID_KEYSTORE_PATH"))
            storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
            keyAlias System.getenv("ANDROID_KEY_ALIAS")
            keyPassword System.getenv("ANDROID_KEY_PASSWORD")
        }
    }`;

module.exports = function withAndroidReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let src = cfg.modResults.contents;
    if (src.includes(MARK)) return cfg;
    // 1) signingConfigs { … } bloğuna release yapılandırmasını ekle
    src = src.replace(/signingConfigs\s*\{/, (m) => `${m}${SIGNING}`);
    // 2) buildTypes.release içinde: anahtar varsa release imzasını kullan
    src = src.replace(/(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig\s+signingConfigs\.debug/, (_m, head) =>
      `${head}signingConfig System.getenv("ANDROID_KEYSTORE_PATH") ? signingConfigs.release : signingConfigs.debug`,
    );
    if (!src.includes('signingConfigs.release')) {
      throw new Error('withAndroidReleaseSigning: app/build.gradle beklenen biçimde değil (signingConfigs / buildTypes.release bulunamadı).');
    }
    cfg.modResults.contents = src;
    return cfg;
  });
};
