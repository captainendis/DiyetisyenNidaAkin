// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Mobil uygulama bağlantı doğrulaması (iOS Universal Links · Android App Links).
 * E-postayla gönderilen tek kullanımlık bağlantılar (danışan davet / şifre sıfırlama, personel şifre sıfırlama)
 * uygulama yüklüyse uygulamada açılır; sitenin geri kalanı tarayıcıda açılmaya devam eder.
 * Ortam değişkeni yoksa dosyalar 404 döner (uygulama yayında değilken hiçbir bağlantı uygulamaya yönlenmez).
 *
 *  - APPLE_TEAM_ID        → /.well-known/apple-app-site-association
 *  - ANDROID_CERT_SHA256  → /.well-known/assetlinks.json (virgülle ayrılmış SHA-256 imza parmak izleri)
 */

/** iOS ve Android paket kimliği (mobile/app.json) */
export const APP_PACKAGE_ID = 'com.nidaakin.app';

/** Uygulamada açılacak yollar — sunucunun e-postaladığı bağlantılar (server/routes/auth.ts, server/services/client-accounts.ts) */
export const APP_LINK_PATHS = ['/hesabim/etkinlestir', '/hesabim/sifre-sifirla', '/panel/sifre-sifirla'] as const;

type Env = Record<string, string | undefined>;

export function appleAppSiteAssociation(env: Env = process.env) {
  const team = env.APPLE_TEAM_ID?.trim().toUpperCase();
  if (!team || !/^[A-Z0-9]{10}$/.test(team)) return null;
  const appID = `${team}.${APP_PACKAGE_ID}`;
  return {
    applinks: {
      details: [
        {
          // iOS 13+
          appIDs: [appID],
          components: APP_LINK_PATHS.map((p) => ({ '/': `${p}*`, comment: 'E-postadaki tek kullanımlık bağlantı' })),
          // iOS 12 ve öncesi
          appID,
          paths: APP_LINK_PATHS.map((p) => `${p}*`),
        },
      ],
    },
  };
}

/** "AB:CD:…" (32 bayt). İki nokta olmadan yazılmış 64 haneli onaltılık değer de kabul edilir. */
export function normalizeFingerprint(raw: string): string | null {
  const hex = raw.trim().toUpperCase().replace(/:/g, '');
  if (!/^[0-9A-F]{64}$/.test(hex)) return null;
  return hex.match(/../g)!.join(':');
}

export function assetLinks(env: Env = process.env) {
  const prints = (env.ANDROID_CERT_SHA256 ?? '')
    .split(',')
    .map(normalizeFingerprint)
    .filter((f): f is string => f !== null);
  if (!prints.length) return null;
  return [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: { namespace: 'android_app', package_name: APP_PACKAGE_ID, sha256_cert_fingerprints: [...new Set(prints)] },
    },
  ];
}

/** Yönlendirmesiz, uzantısız JSON yanıtı (Apple CDN ve Google doğrulayıcısı yönlendirme izlemez) */
export function jsonFile(body: unknown) {
  if (body === null) return new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' },
  });
}
