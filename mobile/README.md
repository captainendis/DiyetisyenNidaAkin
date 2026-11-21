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

## Mağaza derlemesi (EAS)

```bash
npx eas-cli login
npx eas-cli build --platform all --profile production
npx eas-cli submit --platform ios      # App Store Connect
npx eas-cli submit --platform android  # Google Play
```

Paket kimliği: `com.nidaakin.app` (iOS ve Android). Mağaza adı: **Nida Akın**.

## Oturum ve güvenlik

- Giriş isteği `X-App-Client: mobile` başlığını taşır; sunucu cookie yerine **token** döndürür
  (`server/auth/session.ts`, `server/auth/client-session.ts`). Token cihazın güvenli deposunda
  (iOS Keychain / Android Keystore — `expo-secure-store`) saklanır, her istekte `Authorization: Bearer` olarak gider.
- Durum değiştiren isteklerde `X-CSRF-Token` mobilde de zorunludur (giriş yanıtında ve `/me` ucunda döner).
- Sunucu 401 döndürürse (oturum süresi doldu, şifre değişti, hesap kapandı) uygulama giriş ekranına döner.
- İsteğe bağlı **Face ID / parmak izi kilidi** (`src/components/AppLock.tsx`): uygulama 2 dakikadan uzun arka
  planda kalırsa içerik gizlenir.
- Danışan davet / şifre sıfırlama bağlantısı: `nidaakin://baglanti?token=…` ya da e-postadaki bağlantı
  "Davet bağlantım var" ekranına yapıştırılır.

## Klasör yapısı

```
mobile/
├── app.json                 # Uygulama adı, paket kimlikleri, izin metinleri, API adresi
├── metro.config.js          # ../shared klasörünü pakete dahil eder
├── src/
│   ├── app/                 # Expo Router — her dosya bir ekran
│   │   ├── _layout.tsx      # Yazı tipleri, sağlayıcılar, oturuma göre korunan bölümler
│   │   ├── (auth)/          # Karşılama, giriş, şifremi unuttum, davet bağlantısı
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
