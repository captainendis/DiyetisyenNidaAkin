// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Android manifest: zorunlu sayılan donanım özelliklerini isteğe bağlı yapar.
 * orientation: "portrait" (android.hardware.screen.portrait) ve ağ izinleri (android.hardware.wifi) Play'de bu
 * özellikleri zorunlu kılıyordu; Wi-Fi'siz ya da yatay ekranlı cihazlar (bazı tabletler, Chromebook, Android XR)
 * uygulamayı kuramıyordu. Uygulama ikisine de muhtaç değil: mobil veriyle çalışır, ekran yönü yalnızca tercihtir.
 */
const { withAndroidManifest } = require('@expo/config-plugins');

const OPTIONAL = ['android.hardware.screen.portrait', 'android.hardware.wifi'];

module.exports = function withOptionalHardware(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    const features = (manifest['uses-feature'] ??= []);
    for (const name of OPTIONAL) {
      const existing = features.find((f) => f.$?.['android:name'] === name);
      if (existing) existing.$['android:required'] = 'false';
      else features.push({ $: { 'android:name': name, 'android:required': 'false' } });
    }
    return cfg;
  });
};
