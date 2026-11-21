# Nida Akın — Mobil Uygulama (iOS / Android)

Tek uygulama, iki giriş:

| Giriş | Kim | API | Rotalar |
| --- | --- | --- | --- |
| **Danışan girişi** | Danışanlar (Hesabım) | `/api/portal/*` | `src/app/hesabim/**` |
| **Nida Akın & ekip** | Yönetici, diyetisyen, asistan (Panel) | `/api/*` | `src/app/panel/**` |

Expo SDK 58 · Expo Router · React Native 0.88 · TanStack Query · TypeScript. Web sitesindeki
(`../src`) panelin ve Hesabım'ın tamamının mobil karşılığıdır; aynı API'yi kullanır.

## Çalıştırma

```bash
cd mobile
npm install
# Geliştirme: API adresi (telefonun erişebileceği adres — localhost değil!)
EXPO_PUBLIC_API_URL=http://192.168.1.20:3000 npx expo start
```

- Native modüller kullanıldığından (güvenli depo, biyometri, dosya, yazdırma) **geliştirme derlemesi** önerilir:
  `npx expo run:ios` / `npx expo run:android` ya da `npx eas-cli build --profile development`.
- Üretim API adresi `app.json → expo.extra.apiUrl` (varsayılan `https://nidaakin.com`).
- Tip denetimi: `npx tsc --noEmit`

## Mağaza derlemesi (GitHub Actions)

Derleme GitHub'ın runner'larında yapılır: `.github/workflows/mobile.yml` — Android APK/AAB (+ Google Play'e
yükleme), iOS IPA (+ TestFlight). Sırlar ve ilk kurulum: [docs/MOBIL-DERLEME.md](../docs/MOBIL-DERLEME.md).
Mağaza metinleri ve formlar: [docs/MAGAZA.md](../docs/MAGAZA.md).

Paket kimliği: `com.nidaakin.app` (iOS ve Android). Mağaza adı: **Nida Akın**. İsterseniz EAS bulut derlemesi
de kullanılabilir (`eas.json` hazır), ancak gerekli değildir.

## Oturum ve güvenlik

- Giriş isteği `X-App-Client: mobile` başlığını taşır; sunucu cookie yerine **token** döndürür
  (`server/auth/session.ts`, `server/auth/client-session.ts`). Token cihazın güvenli deposunda
  (iOS Keychain / Android Keystore — `expo-secure-store`) saklanır, her istekte `Authorization: Bearer` olarak gider.
- Durum değiştiren isteklerde `X-CSRF-Token` mobilde de zorunludur (giriş yanıtında ve `/me` ucunda döner).
- Sunucu 401 döndürürse (oturum süresi doldu, şifre değişti, hesap kapandı) uygulama giriş ekranına döner.
- İsteğe bağlı **Face ID / parmak izi kilidi** (`src/components/AppLock.tsx`): uygulama 2 dakikadan uzun arka
  planda kalırsa içerik gizlenir.
- Danışan davet / şifre sıfırlama bağlantısı: `nidaakin://baglanti?token=…` ya da e-postadaki bağlantı
  "Davet bağlantım var" ekranına yapıştırılır. Personel şifre sıfırlama: `nidaakin://sifre-yenile?token=…`.

## E-postadaki bağlantılar (Universal Links / App Links)

Sunucunun e-postaladığı tek kullanımlık bağlantılar uygulama yüklü telefonda **uygulamada** açılır:

| E-postadaki bağlantı | Uygulama ekranı |
| --- | --- |
| `https://nidaakin.com/hesabim/etkinlestir?token=…` (danışan daveti) | `(auth)/baglanti.tsx` |
| `https://nidaakin.com/hesabim/sifre-sifirla?token=…` (danışan şifre sıfırlama) | `(auth)/baglanti.tsx` |
| `https://nidaakin.com/panel/sifre-sifirla?token=…` (personel şifre sıfırlama) | `(auth)/sifre-yenile.tsx` |

- Yol dönüşümü: `src/app/+native-intent.tsx` (`redirectSystemPath`) → `src/lib/links.tsx`. Diğer site yolları
  uygulamaya yönlenmez (tarayıcıda açılır).
- Bu ekranlar yalnızca oturum kapalıyken açılır. Oturum açıkken bağlantıya dokunulursa uygulama
  "Oturumu kapatıp devam edilsin mi?" diye sorar; onaylanırsa oturum kapanır ve bağlantının ekranı açılır.
- Uygulama tarafı: `app.json` → `ios.associatedDomains` (`applinks:nidaakin.com`) ve
  `android.intentFilters` (`autoVerify`, https + `nidaakin.com` + üç yol öneki). Değişiklik yeni bir
  **native derleme** gerektirir (Expo Go'da Universal Link çalışmaz).
- Sunucu tarafı: site `/.well-known/apple-app-site-association` ve `/.well-known/assetlinks.json` dosyalarını
  `APPLE_TEAM_ID` ve `ANDROID_CERT_SHA256` ortam değişkenlerinden üretir (boşsa 404). Değerler: Apple Developer →
  Membership details → **Team ID**; Google Play Console → Uygulama bütünlüğü → Uygulama imzalama → **SHA-256
  sertifika parmak izi** (Play'den yüklenmeyen derlemeler için `npx eas-cli credentials` → Android keystore SHA-256;
  birden fazlası virgülle). Ayrıntı: kök README → "Mobil uygulama".
- **Alan adı değişirse** (`extra.apiUrl`): `app.json`'daki `associatedDomains` (`applinks:<alan>`) ve üç
  `intentFilters.data[].host` değerini de aynı alan adıyla güncelleyin, sunucuda `PUBLIC_SITE_URL`'in aynı alan
  adı olduğundan emin olun ve yeni bir derleme alın. `www.` gibi ek alan adları ayrı satır olarak eklenmelidir.
- Test: iOS'ta Notlar'a bağlantıyı yazıp dokunun; Android'de
  `adb shell am start -a android.intent.action.VIEW -d "https://nidaakin.com/panel/sifre-sifirla?token=…"` ve
  doğrulama durumu için `adb shell pm get-app-links com.nidaakin.app`.

## Anlık bildirimler (push)

- `src/lib/push.ts` + `src/components/PushNotifications.tsx`: girişten sonra izin bir kez sorulur, Expo push token'ı
  oturuma göre `POST /api/devices` (Panel) ya da `POST /api/portal/devices` (Hesabım) ile kaydedilir; çıkıştan önce silinir.
  Dokunulan bildirim `data.url` rotasını açar (soğuk açılış dahil); uygulama açıkken gelen bildirim banner olarak
  görünür ve ilgili sorgular tazelenir. Android kanalı: `default` (yüksek önem).
- **Gerekenler:** `npx eas-cli init` (→ `app.json › extra.eas.projectId`; yoksa kayıt sessizce atlanır),
  Android için FCM V1 servis hesabı anahtarı `npx eas-cli credentials` ile, iOS APNs anahtarı EAS derlemesinde otomatik.
  Simülatör/emülatör ve web'de push yoktur — gerçek cihazda geliştirme derlemesiyle deneyin.

## Çevrimdışı kullanım

- Bağlantı yokken üstte uyarı şeridi görünür; sorgular hata vermek yerine bekler, bağlantı gelince tazelenir.
- Uygulama internetsiz açılırsa oturum düşmez: son doğrulanan kimlikle açılır, bağlantı gelince yeniden doğrulanır.
- Cihazda en fazla 7 gün saklanan veriler (`src/lib/offline.ts`) bilinçli olarak dardır:
  danışanın kendi verileri (`['portal', …]`) ve personelin gündem/randevuları (`['dashboard']`, `['appointments']`).
  Klinik notlar, ölçümler, dosyalar ve planlar personel tarafında **diske yazılmaz**. Çıkışta önbellek silinir.

## Klasör yapısı

```
mobile/
├── app.json                 # Uygulama adı, paket kimlikleri, izin metinleri, API adresi
├── metro.config.js          # ../shared klasörünü pakete dahil eder
├── src/
│   ├── app/                 # Expo Router — her dosya bir ekran
│   │   ├── _layout.tsx      # Yazı tipleri, sağlayıcılar, oturuma göre korunan bölümler
│   │   ├── +native-intent.tsx # E-posta bağlantılarını (Universal/App Links) ekranlara çevirir
│   │   ├── (auth)/          # Karşılama, giriş, şifremi unuttum, davet bağlantısı, personel şifre yenileme
│   │   ├── hesabim/         # Danışan: (tabs) + detay ekranları
│   │   └── panel/           # Panel: (tabs) + detay ekranları
│   ├── components/
│   │   ├── ui/              # UI kiti (Screen, Card, Button, TextField, SelectField, Sheet, …)
│   │   ├── nav.tsx          # Başlık/sekme stilleri, okunmamış bildirim sayısı
│   │   ├── AppLock.tsx      # Biyometrik kilit
│   │   └── Logo.tsx
│   ├── features/<alan>/     # Ekranlara özel bileşenler, tipler, API yardımcıları
│   ├── lib/                 # api, auth, query, format, config
│   └── theme/               # Renkler (web ile aynı palet), yazı tipleri, aralıklar
└── types/                   # shared/ bağımlılıkları için tip yönlendirmeleri
```

## Geliştirme kuralları

1. **Veri:** `api` (panel) ya da `portalApi` (danışan) — `src/lib/api.ts`. Arayüz web'deki `src/lib/api.ts` ile
   aynıdır (`get/post/put/patch/del`), yani web ekranındaki çağrılar birebir taşınır. Ek olarak:
   `upload(path, file, fields)`, `download(path, filename)` (indir + paylaş), `printPdf(path, filename)`
   (sunucunun A4 yazdırma sayfasını PDF yapıp paylaşır).
2. **Sorgular:** `useApiQuery(['clients', id], () => api.get(...))` ve
   `useApiMutation(fn, { invalidate: [['clients']] })` — `src/lib/query.ts`. Ekranlar `QueryView` ile
   yükleniyor/hata/veri durumlarını gösterir; listeler çekip-yenile destekler (`Screen refreshing/onRefresh`).
3. **Tipler ve etiketler:** web ile ortak olan her şey `@shared/*`'dan gelir (`@shared/constants`,
   `@shared/portal`, `@shared/schemas`, `@shared/plan`, `@shared/time` …). Tipleri kopyalamayın.
4. **UI:** yalnızca `@/components/ui` ve `@/theme`. Açık zeminde metin için `gold/rose/durum` renkleri değil,
   `*Ink` tonları (WCAG AA). Formlar `Sheet` içinde ya da ayrı ekranda; hata mesajları alan altında
   (`fieldErrors`), genel hatalar `Notice` ya da `useToast()`.
5. **İzinler:** panelde `useStaff().can('clinical:read')` vb. — web'deki menü/ekran kurallarıyla aynı.
   Danışan ekranlarında `useClient().programs` (beslenme / pilates).
6. **Dil:** tüm metinler Türkçe; danışana "sen", personele nötr dil (web'deki metinlerle aynı ton).
7. **Erişilebilirlik:** dokunma alanları ≥ 44 pt, ikon butonlarda `accessibilityLabel`, durumlar renk + metin.
