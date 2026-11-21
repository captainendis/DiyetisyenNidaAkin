# Mobil uygulama derlemesi — GitHub Actions

Uygulama, GitHub'ın kendi runner'larında derlenir (`.github/workflows/mobile.yml`); EAS bulut derlemesi
gerekmez. Android Ubuntu'da, iOS macOS'ta derlenir.

| Ne zaman | Ne olur |
| --- | --- |
| `mobile/` ya da `shared/` değişen her push | Android doğrulama derlemesi (APK + AAB, **Artifacts** altında 30 gün) |
| Actions → **Mobil derleme** → *Run workflow* | Platform (android / ios / both), Play kanalı ve TestFlight seçilerek |
| `mobile-v1.0.0` gibi bir etiket | İki platform + Play **dahili test** kanalı (taslak) + TestFlight |

Derleme numarası (`versionCode` / `buildNumber`) çalıştırma numarasıdır ve her çalıştırmada artar.
Sürüm adı `mobile/app.json → expo.version`'dan gelir (mağazaya yeni sürüm gönderirken artırın).

Sırlar **Settings → Secrets and variables → Actions** altına eklenir. Eksik sırlarda derleme yine çalışır:
Android debug imzalı çıkar (Play kabul etmez), iOS yalnızca imzasız simülatör derlemesi yapılır.

---

## 1. Android imza anahtarı (bir kez)

Google Play **Uygulama İmzalama** kullanır: siz bir *yükleme anahtarı* ile imzalarsınız, Play uygulamayı kendi
anahtarıyla yeniden imzalar. Yükleme anahtarını üretin (şifreyi güvenli bir kasada saklayın; kaybolursa Play
Console'dan sıfırlanabilir):

```bash
keytool -genkeypair -v -storetype PKCS12 -keystore nidaakin-upload.keystore \
  -alias nidaakin -keyalg RSA -keysize 4096 -validity 10000 \
  -dname "CN=Nida Akin, O=Nida Akin, C=TR"
base64 -w0 nidaakin-upload.keystore > keystore.b64      # macOS: base64 -i nidaakin-upload.keystore
```

| Sır | Değer |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | `keystore.b64` dosyasının içeriği |
| `ANDROID_KEYSTORE_PASSWORD` | keystore şifresi |
| `ANDROID_KEY_ALIAS` | `nidaakin` |
| `ANDROID_KEY_PASSWORD` | anahtar şifresi (PKCS12'de keystore şifresiyle aynı) |

`nidaakin-upload.keystore` ve `keystore.b64` dosyalarını depoya **eklemeyin**; sırlara ekledikten sonra
yalnızca kasada tutun.

## 2. Google Play'e otomatik yükleme

1. Play Console'da uygulamayı oluşturun (paket adı `com.nidaakin.app`).
2. **İlk AAB'yi elle yükleyin:** Actions'ta bir Android derlemesi çalıştırın, Artifacts'tan `.aab`'yi indirip
   Play Console → Test → Dahili test → Yeni sürüm ile yükleyin. (Google, API ile yüklemeden önce bir elle
   yükleme ister.)
3. Google Cloud Console'da bir **hizmet hesabı** oluşturup JSON anahtarını indirin; Play Console →
   Kullanıcılar ve izinler → bu hesabı davet edin ("Sürümleri yayınla" izni, yalnızca bu uygulama).
4. Sır: `PLAY_SERVICE_ACCOUNT_JSON` = JSON dosyasının tamamı.

Sonrasında *Run workflow* → `play_track: internal`. Uygulama Play'de henüz yayınlanmadıysa durum **draft**
olmalıdır (varsayılan); taslak sürüm Play Console'dan incelemeye gönderilir.

## 3. Anlık bildirimler (Android + iOS)

Bildirimler Expo push servisiyle gönderilir; bunun için (yalnızca) bir Expo proje kimliği gerekir:

```bash
cd mobile && npx eas-cli login && npx eas-cli init     # app.json'a extra.eas.projectId yazar → commit'leyin
```

Ya da kimliği **Variables** altına `EAS_PROJECT_ID` olarak ekleyin.

- **Android:** Firebase'de proje oluşturun, `com.nidaakin.app` paketiyle Android uygulaması ekleyin,
  `google-services.json`'u indirin → sır `GOOGLE_SERVICES_JSON` (dosyanın tamamı). Firebase → Proje
  ayarları → Hizmet hesapları → yeni özel anahtar (FCM V1) → `npx eas-cli credentials` ile Expo'ya yükleyin
  (sunucunun push gönderebilmesi için).
- **iOS:** Apple Developer → Keys → **Apple Push Notifications service (APNs)** anahtarı oluşturun →
  `npx eas-cli credentials` → iOS → Push Notifications ile Expo'ya yükleyin. Uygulamadaki "Push
  Notifications" yeteneği Xcode otomatik imzasıyla kendiliğinden eklenir.

## 4. iOS — TestFlight (Apple Developer hesabı açıldıktan sonra)

1. App Store Connect → Uygulamalarım → **+** → paket kimliği `com.nidaakin.app` ile uygulamayı oluşturun.
2. App Store Connect → Kullanıcılar ve Erişim → **Entegrasyonlar → App Store Connect API** → anahtar
   oluşturun (rol: **Admin** — otomatik imzanın sertifika/profil oluşturabilmesi için). `.p8` dosyasını
   indirin (yalnızca bir kez indirilebilir).
3. Sırlar:

| Sır | Nereden |
| --- | --- |
| `APPLE_TEAM_ID` | developer.apple.com → Account → Membership → Team ID |
| `ASC_KEY_ID` | API anahtarının "Key ID"si |
| `ASC_ISSUER_ID` | API anahtarları sayfasının üstündeki "Issuer ID" |
| `ASC_KEY_P8` | `.p8` dosyasının tamamı (`-----BEGIN PRIVATE KEY-----` dahil) |

Sonra *Run workflow* → `platform: ios` (ya da `both`), `testflight: true`. Derleme 10–30 dakika içinde
TestFlight'ta görünür. İlk derlemede "Export Compliance" sorusu sorulmaz (`ITSAppUsesNonExemptEncryption: false`).

## 5. E-postadaki bağlantılar (Universal Links / App Links)

Sunucu ortam değişkenleri (README → Mobil uygulama):

- `APPLE_TEAM_ID` — yukarıdaki Team ID.
- `ANDROID_CERT_SHA256` — Play Console → Test ve yayınla → Uygulama bütünlüğü → **Uygulama imzalama anahtarı**
  sertifikasının SHA-256'sı. GitHub'dan indirilen APK'yı doğrudan kuracaksanız yükleme anahtarının parmak
  izini de virgülle ekleyin: `keytool -list -v -keystore nidaakin-upload.keystore -alias nidaakin`.

## Sorun giderme

- **"debug imzalı" uyarısı:** `ANDROID_KEYSTORE_BASE64` eksik; APK test için kurulabilir ama Play kabul etmez.
- **Play "Version code already used":** daha önce elle yüklediğiniz sürümün kodu yüksekse, `app.config.js`'te
  `BUILD_NUMBER`'a sabit bir taban ekleyin (ör. `run_number + 100`).
- **iOS "No profiles for com.nidaakin.app":** API anahtarının rolü Admin olmalı ve uygulama App Store
  Connect'te oluşturulmuş olmalı.
- Yerel derleme her zaman mümkündür: `cd mobile && npx expo run:android` / `npx expo run:ios`.
