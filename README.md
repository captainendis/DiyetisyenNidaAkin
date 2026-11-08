# Nida Akın — Diyetisyen · Web Sitesi ve Yönetim Paneli

Diyetisyen Nida Akın için geliştirilmiş, **premium editorial tasarımlı herkese açık web sitesi** ve
**veritabanına bağlı, kimlik doğrulamalı diyetisyen yönetim paneli** (randevu, danışan, içerik, raporlama).

> **Önemli:** Bu depoda doğrulanmamış hiçbir iletişim bilgisi, eğitim/sertifika bilgisi, çalışma saati,
> müşteri yorumu veya istatistik **yoktur**. Boş bırakılan alanlar sitede zarif bir yer tutucuyla
> gösterilir ve yapılandırılmış veriye (Schema.org) yazılmaz. Ayrıntılar: [Yayın öncesi kontrol listesi](#yayın-öncesi-kontrol-listesi).

---

## İçindekiler

1. [Teknoloji](#teknoloji)
2. [Proje yapısı](#proje-yapısı)
3. [Hızlı kurulum (geliştirme)](#hızlı-kurulum-geliştirme)
4. [Ortam değişkenleri](#ortam-değişkenleri)
5. [Veritabanı ve migration](#veritabanı-ve-migration)
6. [Yönetici hesabı oluşturma](#yönetici-hesabı-oluşturma)
7. [Demo modu](#demo-modu)
8. [İçerik ve yapılandırma](#içerik-ve-yapılandırma)
9. [Randevu sistemi nasıl çalışır](#randevu-sistemi-nasıl-çalışır)
10. [Güvenlik ve KVKK](#güvenlik-ve-kvkk)
11. [API özeti](#api-özeti)
12. [Test](#test)
13. [Üretim derlemesi ve dağıtım](#üretim-derlemesi-ve-dağıtım)
14. [Yedekleme ve veri saklama](#yedekleme-ve-veri-saklama)
15. [Görseller](#görseller)
16. [Yayın öncesi kontrol listesi](#yayın-öncesi-kontrol-listesi)

---

## Teknoloji

| Katman | Seçim |
| --- | --- |
| Ön yüz | React 19 · TypeScript · Vite · Tailwind CSS v4 · Motion · Lucide (yalnızca panelde) |
| Arka uç | Node.js (≥ 20.19) · Express 5 · Zod |
| Veritabanı | PostgreSQL 16 · Prisma ORM 7 (`@prisma/adapter-pg`) |
| Kimlik doğrulama | Sunucu taraflı oturum (HttpOnly + SameSite=Strict cookie) · CSRF token · scrypt parola özeti |
| Şifreleme | AES-256-GCM (görüşme notları, ölçümler, danışan dosyaları) |
| Saat dilimi | Tüm iş kuralları `Europe/Istanbul`; veritabanında `timestamptz` (UTC) |

Tek bir Node süreci hem API'yi hem de derlenmiş siteyi sunar (üretimde). Geliştirmede Vite (5173) API'ye (4000) proxy yapar.

## Proje yapısı

```
├── prisma/
│   ├── schema.prisma          # Veritabanı şeması (roller, kullanıcılar, randevular, danışanlar, …)
│   ├── migrations/            # SQL migration'ları (onaylı randevu çakışma kısıtı dahil)
│   ├── seed.ts                # İlk kurulum verisi (idempotent)
│   └── seed-demo.ts           # Yalnızca DEMO_MODE=true iken örnek veri
├── shared/                    # İstemci + sunucu ortak kodu
│   ├── site-config.ts         # ★ MERKEZİ YAPILANDIRMA (iletişim, sosyal medya, işletme bilgisi — hepsi null)
│   ├── settings.ts            # İçerik şemaları + varsayılan metinler
│   ├── schemas.ts             # Zod doğrulama şemaları (form + API)
│   ├── constants.ts           # Durum etiketleri, sabitler
│   ├── seed-content.ts        # Hizmet / blog / SSS taslakları
│   └── time.ts                # Europe/Istanbul tarih yardımcıları
├── server/
│   ├── index.ts / app.ts      # Express uygulaması, güvenlik başlıkları, periyodik işler
│   ├── auth/                  # Oturum, CSRF, rol-izin eşlemesi
│   ├── routes/                # REST uç noktaları (modül başına bir dosya)
│   ├── services/              # Müsaitlik/çakışma, randevu iş kuralları, bildirimler, e-posta, ayarlar
│   ├── lib/                   # env, db, crypto, audit, storage, http hataları
│   └── seo.ts                 # robots.txt, sitemap.xml, sunucu taraflı meta enjeksiyonu
├── src/
│   ├── components/            # layout, navigation, sections, cards, forms, ui, icons, panel, seo, motion
│   ├── pages/                 # Herkese açık sayfalar + pages/panel/*
│   ├── data/                  # SiteContext (panelden yönetilen içerik)
│   ├── config/ lib/ hooks/ styles/
├── scripts/                   # create-admin, reset-password, retention, backup, prepare-images
├── public/images/             # Optimize mekân görselleri (AVIF + WebP)
└── assets-src/                # Kaynak görseller
```

## Hızlı kurulum (geliştirme)

Gereksinimler: Node.js ≥ 20.19 (önerilen 22), PostgreSQL ≥ 14, (görseller için isteğe bağlı) Python 3 + Pillow.

```bash
# 1) Bağımlılıklar
npm install

# 2) Ortam değişkenleri
cp .env.example .env
# DATA_ENCRYPTION_KEY üretin ve .env'e yazın:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# 3) Veritabanı (örnek)
createuser -P nida            # şifre: .env'deki ile aynı
createdb -O nida nidaakin

# 4) Şema + istemci + ilk veriler
npx prisma migrate deploy     # (geliştirmede şema değiştirirseniz: npm run db:migrate)
npx prisma generate
npm run db:seed

# 5) Yönetici hesabı (etkileşimli; şifre ekrana yazılmaz)
npm run admin:create

# 6) Çalıştır
npm run dev                   # Site: http://localhost:5173  ·  Panel: http://localhost:5173/panel
```

## Ortam değişkenleri

Tam liste ve açıklamalar `.env.example` içindedir.

| Değişken | Zorunlu | Açıklama |
| --- | --- | --- |
| `DATABASE_URL` | ✔ | PostgreSQL bağlantı adresi |
| `DATA_ENCRYPTION_KEY` | ✔ | 32 baytlık base64 anahtar. Klinik veriler bununla şifrelenir. **Kaybedilirse veri çözülemez; değiştirilirse eski veri okunamaz.** Yedeklerden ayrı, güvenli bir kasada saklayın. |
| `PUBLIC_SITE_URL` | ✔ (üretim) | Canonical, sitemap, Open Graph ve e-posta bağlantıları için kök adres (ör. `https://nidaakin.com`) |
| `NODE_ENV` | | `production` iken cookie'ler `Secure` olur ve sunucu derlenmiş siteyi servis eder |
| `PORT` | | Varsayılan 4000 |
| `TRUST_PROXY` | | Ters vekil arkasında `1` (gerçek istemci IP'si → hız sınırlama doğru çalışır) |
| `SESSION_TTL_HOURS` / `SESSION_REMEMBER_DAYS` | | Oturum süreleri (varsayılan 12 saat / "Beni hatırla" 30 gün) |
| `UPLOAD_DIR` | | Yüklemeler (varsayılan `./storage`). `private/` alt klasörü şifreli danışan dosyalarıdır, asla statik servis edilmez |
| `SMTP_*`, `MAIL_FROM` | | İsteğe bağlı. Boşsa e-posta **gönderilmez** ve sistem gönderiyormuş gibi davranmaz |
| `DEMO_MODE` | | `true` ise panelde "Demo modu" uyarısı görünür ve demo seed çalıştırılabilir |

## Veritabanı ve migration

```bash
npm run db:migrate     # geliştirme: şema değişikliğinden yeni migration üretir ve uygular
npm run db:deploy      # üretim: bekleyen migration'ları uygular (veri kaybı olmadan)
npm run db:generate    # Prisma istemcisini üretir (npm install sonrası otomatik)
npm run db:seed        # temel verileri yazar; mevcut içeriği EZMEZ, tekrar çalıştırılabilir
```

Tablolar: `users`, `roles`, `sessions`, `password_reset_tokens`, `clients`, `appointments`,
`appointment_status_history`, `services`, `availability_rules`, `blocked_dates`, `notifications`,
`notification_deliveries`, `consultation_notes`, `measurements`, `client_files`, `blog_categories`,
`blog_posts`, `faqs`, `media_assets`, `website_settings`, `nutrition_plans`, `recipes`, `audit_logs`.

`appointments_no_overlap_confirmed` adlı PostgreSQL **exclusion constraint**, onaylanmış/tamamlanmış randevuların
zaman aralıklarının çakışmasını veritabanı seviyesinde de engeller (uygulama katmanındaki kilitli kontrolün yedeği).

## Yönetici hesabı oluşturma

Herkese açık kayıt **yoktur**. İlk yönetici yalnızca sunucuya erişimi olan kişi tarafından oluşturulur:

```bash
npm run admin:create                 # etkileşimli (önerilen)
# Otomasyon için (şifre kabuk geçmişine düşebilir, dikkat):
ADMIN_EMAIL=... ADMIN_PASSWORD=... ADMIN_FIRST_NAME=Nida ADMIN_LAST_NAME=Akın npm run admin:create
# Asistan hesabı (klinik verilere erişemez):
ADMIN_ROLE=ASSISTANT npm run admin:create
```

İkinci bir yönetici oluşturmak `ALLOW_ADDITIONAL_ADMIN=1` gerektirir.

**Şifre sıfırlama:** Panelde "Şifremi unuttum" akışı vardır. SMTP yapılandırılmamışsa e-posta gönderilmez
(ekranda bu açıkça söylenir; geliştirme ortamında bağlantı sunucu konsoluna yazılır). Sunucu erişimiyle:

```bash
npm run admin:reset-password         # tüm açık oturumları da kapatır
```

## Demo modu

Panel boşken nasıl göründüğünü görmek için **yalnızca geliştirme/tanıtım ortamında**:

```bash
DEMO_MODE=true npm run db:seed:demo            # 18 örnek danışan, ~50 gün randevu, şifreli örnek notlar
DEMO_MODE=true npm run db:seed:demo -- --clean # demo kayıtlarını siler
```

Demo danışanların e-postası `@demo.invalid` ile biter. Demo betiği çalışma saatlerini yalnızca **hiç**
çalışma günü tanımlı değilse yazar; taslak blog yazılarını yayınlar. Gerçek kurulumda kullanmayın.

## İçerik ve yapılandırma

- **Merkezi yapılandırma:** `shared/site-config.ts` — telefon, WhatsApp, e-posta, adres, harita, sosyal medya,
  resmi unvan. Hepsi bilinçli olarak `null`. İlk `db:seed` ile veritabanına aktarılır; sonrasında
  **Panel → Web Sitesi İçeriği → İletişim & Sosyal** üzerinden yönetilir (panel değeri her zaman önceliklidir).
- **Metinler:** `shared/settings.ts` varsayılanları; panelden düzenlenir (Ana sayfa, Hakkımda, SEO …).
- **Hizmetler:** Panel → Hizmetler. Seed ile gelen 6 hizmet **taslaktır**; sunulduğu doğrulanmalıdır.
- **Blog:** Seed yazıları **taslak** gelir. "Uzman onayı verildi" işaretlenmeden yayınlanamaz; her yazıda
  "tıbbi tavsiye yerine geçmez" uyarısı gösterilir.
- **Çalışma saatleri:** Seed'de **tüm günler kapalıdır** (saatler uydurulmadı). Panel → Çalışma Takvimi'nden
  girilene kadar web sitesindeki form yalnızca "saat seçmeden iletişim talebi" kabul eder.
- **Görseller:** **Panel → Web Sitesi İçeriği → Görseller** — ana sayfa kapak fotoğrafı, görüşme alanı fotoğrafı ve portre.
  Yüklenen fotoğraf sunucuda döndürülür, **konum (GPS) ve cihaz bilgileri silinir**, AVIF + WebP olarak 4 boyuta kadar
  hazırlanır; önizlemeye tıklanarak odak noktası seçilir. Görsel yüklenmemişse yerleşik mekân fotoğrafları, portre için
  stok fotoğraf yerine zarif bir yer tutucu gösterilir.
- **Kurulum kontrol listesi:** Panel ana sayfasındaki "Siteyi tamamlayın" kartı, yayın öncesi eksik bilgileri (iletişim,
  çalışma saatleri, görseller, sertifikalar, hizmet doğrulaması, KVKK) gerçek veriden hesaplayıp ilgili ekrana bağlar.
- **Mekân:** Pelin Tek Studio Bahçekent (Esenyurt) — adres ve harita doğrulanmış olarak yapılandırmadadır. Görüşmeler
  stüdyonun üst katındaki danışmanlık alanında yapılır; vitrindeki pilates/yoga vb. stüdyonun hizmetleridir ve sitede
  diyetisyenin hizmeti olarak gösterilmez.

## Beslenme planları (tek sayfa PDF)

**Panel → Beslenme Planları** veya **Danışan → Beslenme Planları** sekmesi.

- Plan; başlık, su hedefi (bardak takip kutucukları), hareket hedefi (haftanın günleri), en fazla 7 öğün × 3 seçenek,
  alışkanlıklar kutusu, porsiyon tablosu, alt not ve imzadan oluşur. Düzen, diyetisyenin örnek planını temel alır.
- Danışan seçilince başlık Türkçe ekle otomatik oluşur (“Ömer’in / Ayşe’nin / Nida’nın beslenme planı”).
- **Şablonlar:** Danışana bağlı olmayan listeler. Kurulumda örnek plandan oluşturulan “1. ay, 1. liste” şablonu gelir;
  yeni planlar bir şablondan kopyalanarak başlar. Her plan “Şablon olarak kaydet” ile şablona dönüştürülebilir.
- **Canlı önizleme** PDF ile aynı şablonu kullanır (`shared/plan-template.ts`). İçerik uzarsa tüm ölçüler orantılı
  küçültülerek **tek A4 sayfaya sığdırılır**; yazı %85'in altına inerse uyarı verilir, sığmazsa (%72 sınırı) indirmede bildirilir.
- **PDF** sunucuda Chromium ile üretilir: vektör metin (telefonda yakınlaştırınca net kalır, aranabilir), gömülü Manrope
  yazı tipi, etiketli (erişilebilir) PDF, renkler baskıda korunur. PDF diske yazılmaz, doğrudan indirilir.
- Plan içerikleri sağlık verisi niteliği taşıyabileceğinden **şifreli** saklanır; yalnızca klinik yetkili roller erişir,
  görüntüleme ve PDF indirme denetim kaydına yazılır.
- Sunucuda Chromium gerekir: Docker imajında otomatik kurulur; diğer ortamlarda `CHROMIUM_PATH` ile yolu verin
  (boşsa Playwright'ın kurulu tarayıcısı aranır).

## Tarifler ve plan ek sayfası

**Panel → Tarifler** — diyetisyenin fotoğraflı tarif kütüphanesi.

- Tarif; ad, kategori (Kahvaltı, Ara öğün, Ana yemek, Çorba, Salata, Tatlı, İçecek), kısa açıklama, porsiyon,
  hazırlık/pişirme süresi, porsiyon başına yaklaşık kalori, malzemeler (satır satır), adım adım hazırlanış ve isteğe bağlı
  ipucundan oluşur. Kategori süzgeci ve ad/malzeme araması vardır.
- **Fotoğraf:** sunucuda döndürülür, **konum (GPS) ve cihaz bilgileri silinir**, 4:3 olarak (dikkat çeken bölge korunarak)
  kırpılır ve 480 px (panel/önizleme) + 960 px (baskı) WebP olarak `storage/public/recipes/` altına yazılır.
- **Plana ekleme:** Plan düzenleyicideki **“Tarif önerileri (ek sayfa)”** bölümünden kütüphaneden çoklu seçimle en fazla
  8 tarif eklenir (seçim penceresinden yeni tarif de oluşturulabilir). Her tarifin danışanın göreceği bir etiketi vardır;
  plandaki öğün adına göre otomatik önerilir (“Kahvaltı için öneri”, “Ara öğün için öneri” …) ve değiştirilebilir. Sıra
  değiştirilebilir, ek sayfa başlığı düzenlenebilir.
- **PDF:** 1. sayfa plan olarak kalır (altyazıda “Tarif önerileri sonraki sayfada.” notu çıkar); tarifler fotoğraflarıyla
  ek A4 sayfalara **otomatik dağıtılır** (sığdığı kadar sayfa başına, genelde 2 tarif). Tek başına sayfayı aşan uzun bir
  tarif %70'e kadar küçültülür; yine sığmazsa önizlemede ve indirmede uyarı verilir. Canlı önizleme tüm sayfaları gösterir.
- Planlar tarife **referansla** bağlanır: tarif sonradan düzenlenirse planların PDF'i güncel hâliyle basılır; silinen tarif
  planlarda “silinmiş” olarak işaretlenir ve PDF'e basılmaz.
- Tarifler danışana ait olmadığından şifrelenmez; erişim planlarla aynı izinlerle (klinik yetkili roller) sınırlıdır ve
  ekleme/düzenleme/silme denetim kaydına yazılır.

## Randevu sistemi nasıl çalışır

1. Ziyaretçi web sitesinde gün/saat seçer (yalnızca çalışma saatleri, kapalı günler, öğle arası, minimum ön süre ve
   mevcut randevular düşülerek hesaplanan **gerçek boş dilimler** gösterilir) veya saat seçmeden iletişim talebi bırakır.
2. Talep doğrulanır, kaydedilir; durum **"Onay Bekliyor"** (saatsiz taleplerde **"Yeni Talep"**). Ziyaretçiye
   **sahte bir onay gösterilmez**; talebin incelendiği ve iletişime geçileceği söylenir.
3. Panelde bildirim oluşur, bildirim sayacı ve dashboard güncellenir.
4. Diyetisyen onaylar / reddeder / tarihi-saati değiştirir. Onay ve saat değişikliğinde çakışma kontrolü
   **PostgreSQL advisory lock + transaction** içinde yeniden yapılır; ayrıca veritabanı kısıtı vardır.
5. Onaylanan talep, telefon/e-posta ile eşleşen danışana bağlanır; yoksa danışan kaydı oluşturulur.
6. Yaklaşan (24 saat içindeki) onaylı randevular için sunucu her 5 dakikada bir hatırlatma bildirimi üretir.

Durumlar: Yeni Talep · Onay Bekliyor · Onaylandı · Tamamlandı · İptal Edildi · Gelmedi — her değişiklik
`appointment_status_history` tablosuna yazılır.

## Güvenlik ve KVKK

**Uygulanan teknik önlemler**

- Sunucu taraflı oturumlar; cookie `HttpOnly`, `SameSite=Strict`, üretimde `Secure`. Veritabanında yalnızca token özeti.
- Durum değiştiren tüm panel isteklerinde **CSRF token** doğrulaması.
- Parolalar **scrypt** ile özetlenir; parola politikası (≥10 karakter, harf + rakam).
- **Giriş denemesi sınırlama:** IP başına hız sınırı + hesap bazlı kilit (5 hatalı deneme → 15 dk). Kullanıcı var/yok bilgisi sızdırılmaz.
- Parola değişikliği/sıfırlamasında tüm eski oturumlar geçersizleşir.
- **Rol tabanlı erişim:** Yönetici, Diyetisyen, Asistan. Asistan klinik verilere (notlar, ölçümler, dosyalar) erişemez.
- Görüşme notları, ölçümler ve danışan dosyaları **AES-256-GCM** ile şifrelenmiş olarak saklanır.
- Ölçüm/beslenme takibi ve dosya yükleme, danışanın **açık rızası** panelde kayıt altına alınmadan açılmaz.
- Dosya yüklemelerinde içerik imzası (magic bytes) kontrolü, boyut sınırı, rastgele dosya adı; danışan dosyaları
  statik servis edilmez.
- **Audit log:** giriş/çıkış, klinik veri görüntüleme, kayıt değişiklikleri, dışa aktarma ve silme işlemleri
  (kişisel/sağlık içeriği log'a yazılmaz).
- Güvenlik başlıkları (Helmet, CSP, `frame-ancestors 'none'`), panel sayfaları `noindex`.
- Herkese açık API'ler yalnızca yayınlanmış içerik döner; sağlık verisi içeren hiçbir herkese açık uç yoktur.
- Web formunda bot tuzağı (honeypot) ve hız sınırı.

**KVKK süreçleri**

- Randevu formunda **aydınlatma metni onayı** (zorunlu) ve **açık rıza** (ayrı ve isteğe bağlı) birbirinden ayrıdır; zaman damgalarıyla saklanır.
- Danışan detayında **verileri dışa aktar** (md. 11 erişim talebi) ve **kalıcı silme / anonimleştirme**.
- `npm run data:retention` — saklama süresi dolan pasif danışanları anonimleştirir (`--dry-run` ile önizleme).
- Yasal metinler (`/kvkk-aydinlatma-metni`, `/acik-riza-metni`, `/gizlilik-politikasi`, `/cerez-politikasi`) **taslaktır**.

> ⚠️ Bu yazılım KVKK uyumluluğunu **otomatik olarak sağlamaz**. Aydınlatma ve açık rıza metinleri, veri işleme
> envanteri, VERBİS yükümlülüğü, saklama-imha politikası ve yurt dışı aktarım (barındırma/e-posta sağlayıcısı)
> değerlendirmesi yayın öncesinde bir hukuk uzmanı tarafından yapılmalıdır.

## API özeti

Tüm yanıtlar JSON'dur. Hatalar: `{ "error": { "code", "message", "details"? } }` — doğrulama hatalarında
`details.fields` alan bazlı Türkçe mesajlar içerir (HTTP 422). Çakışmalar HTTP 409 döner.

<!-- api:start -->
**Kimlik doğrulama** (`/api/auth`)

| Yöntem | Yol | Açıklama |
| --- | --- | --- |
| POST | `/login` | `{ email, password, remember }` → oturum cookie'si. 401 hatalı bilgi · 423 hesap kilitli · 429 hız sınırı |
| POST | `/logout` | Oturumu kapatır |
| GET | `/me` | Kullanıcı, izinler ve CSRF token'ı |
| POST | `/forgot-password` · `/reset-password` · `/change-password` | Şifre işlemleri |

**Herkese açık** (`/api/public`, oturum gerekmez, kişisel veri dönmez)

| Yöntem | Yol | Açıklama |
| --- | --- | --- |
| GET | `/site` | Yayındaki içerik, hizmetler, SSS, blog kategorileri |
| GET | `/services/:slug` | Hizmet detayı |
| GET | `/blog?category&page` · `/blog/:slug` | Yayınlanmış yazılar (+ ilgili yazılar) |
| GET | `/availability/days?from&to&serviceId` | Uygun saat sayısı olan günler |
| GET | `/availability/slots?date&serviceId` | Günün boş dilimleri |
| POST | `/appointments` | Randevu talebi → 201 `{ status, reference }`; 409 `SLOT_TAKEN`, `TOO_SOON`, `DUPLICATE_REQUEST` … |

**Panel** (oturum + CSRF; rol izinleri sunucuda denetlenir)

| Modül | Uç noktalar |
| --- | --- |
| Dashboard | `GET /api/dashboard/stats` · `/agenda?date` · `/weekly` · `/setup` (kurulum kontrol listesi) |
| Randevular | `GET/POST /api/appointments` · `GET/PATCH/DELETE /api/appointments/:id` · `POST /:id/status` · `GET /slots?date&duration&ignoreId` · `GET /day-plans?from&to` |
| Danışanlar | `GET/POST /api/clients` · `GET/PATCH/DELETE /:id` · `GET /:id/appointments` · `/:id/notes` (CRUD) · `POST /:id/health-consent` · `POST /:id/kvkk-notice` · `/:id/measurements` (CRUD) · `/:id/files` (yükle/listele/indir/sil) · `GET /:id/export` |
| Bildirimler | `GET /api/notifications` · `GET /unread-count` · `POST /:id/read` · `/:id/unread` · `/read-all` · `DELETE /:id` · `GET /channels` |
| Raporlar | `GET /api/reports?from&to` · `GET /export.csv?from&to` |
| Hizmetler | `GET/POST /api/services` · `PATCH/DELETE /:id` · `POST /reorder` · `PATCH /:id/visibility` |
| Çalışma takvimi | `GET/PUT /api/availability/rules` · `GET/POST /api/availability/blocked-dates` · `DELETE /blocked-dates/:id` |
| İçerik | `GET /api/content/settings` · `PUT /settings/:key` · `POST /site-images` (görsel işleme) · `/posts` (CRUD) · `POST /posts/:id/status` · `GET /categories` · `/faqs` (CRUD + `/reorder`) · `/media` (yükle/listele/sil) |
| Ayarlar | `GET/PATCH /api/settings/profile` · `/notification-prefs` · `GET /channels` · `GET /sessions` · `DELETE /sessions/:id` · `GET /users` · `PATCH /users/:id` |
| Beslenme planları | `GET/POST /api/plans` (`?clientId`, `?templates=1`) · `GET/PATCH/DELETE /:id` · `GET /:id/pdf` |
| Tarifler | `GET/POST /api/recipes` (`?category`, `?q`) · `GET/PATCH/DELETE /:id` · `POST/DELETE /:id/image` |
| Denetim kaydı | `GET /api/audit-logs` · `GET /facets` |
<!-- api:end -->

## Test

```bash
npm test               # vitest: 15 test — müsaitlik birim testleri + çakışma/eşzamanlılık entegrasyon testleri (veritabanı gerekir)
npm run typecheck      # istemci + sunucu tip kontrolü
```

## Üretim derlemesi ve dağıtım

```bash
npm ci
npx prisma generate
npm run build          # dist/ (site) + dist-server/ (API ve CLI betikleri)
npm run db:deploy
npm run prod:seed      # yalnızca ilk kurulumda
npm run prod:admin:create
npm start              # NODE_ENV=production, PORT=4000
```

Üretimde tek süreç: `/api/*` API, diğer tüm yollar derlenmiş site (sunucu, her sayfa için başlık, açıklama,
canonical, Open Graph ve JSON-LD'yi HTML'e enjekte eder; `/robots.txt` ve `/sitemap.xml` dinamik üretilir).

**Docker:**

```bash
cp .env.example .env    # DATA_ENCRYPTION_KEY, PUBLIC_SITE_URL vb. doldurun
export POSTGRES_PASSWORD='güçlü-bir-şifre'
docker compose up -d --build
docker compose exec app node dist-server/seed.js
docker compose exec -it app node dist-server/create-admin.js
```

**Ters vekil (ör. Caddy):** HTTPS zorunludur (Secure cookie). `TRUST_PROXY=1` ayarlayın.

```
nidaakin.com {
  encode zstd gzip
  reverse_proxy 127.0.0.1:4000
}
```

**Kontrol listesi:** `NODE_ENV=production` · HTTPS · `PUBLIC_SITE_URL` doğru · güçlü veritabanı şifresi ·
`DATA_ENCRYPTION_KEY` kasada · `storage/` kalıcı diskte · düzenli yedek · SMTP (isteğe bağlı) · periyodik
`prod:data:retention` (ör. ayda bir cron).

## Yedekleme ve veri saklama

```bash
npm run backup                 # pg_dump (custom format) + storage/ arşivi → ./backups (izinler 600)
npm run data:retention -- --dry-run
npm run data:retention
```

Yedekler kişisel veri içerir: şifreli bir hedefte, erişimi kısıtlanmış olarak saklayın. `DATA_ENCRYPTION_KEY`'i
yedeklerle aynı yerde tutmayın. Geri yükleme komutları `scripts/backup.sh` içindedir.

## Görseller

`public/images/` altındaki mekân görselleri `assets-src/mekan-referans.png` dosyasından **arayüz öğelerine
dokunmadan** kırpılarak üretildi (yalnızca hafif kontrast/sıcaklık ayarı; mimari ve perspektif korunur).
Bunlar yalnızca yerleşik yedek görsellerdir; gerçek fotoğraflar **panelden** yüklenir (bkz. İçerik ve yapılandırma).

## Yayın öncesi kontrol listesi

- [ ] Telefon, WhatsApp, e-posta, adres, harita ve sosyal medya bilgileri panelden girildi
- [ ] Gerçek çalışma saatleri ve tatil/izin günleri girildi
- [ ] Hizmetlerin gerçekten sunulduğu doğrulandı; metinler düzenlendi (ücret gösterimi isteğe bağlı)
- [ ] Hakkımda metni, eğitim ve sertifika bilgileri (doğrulanmış) eklendi
- [ ] Profesyonel portre fotoğrafı eklendi (yer tutucu kaldırıldı)
- [ ] Yüksek çözünürlüklü gerçek mekân fotoğrafları işlendi
- [ ] Blog yazıları uzman tarafından incelenip yayınlandı
- [ ] KVKK aydınlatma, açık rıza, gizlilik ve çerez metinleri hukuk uzmanınca hazırlandı/onaylandı
- [ ] Veri sorumlusu (resmi unvan) ve KVKK başvuru e-postası girildi
- [ ] SMTP yapılandırıldı (şifre sıfırlama ve e-posta bildirimleri için) — isteğe bağlı
- [ ] Yedekleme ve saklama-imha işleri zamanlandı

## Telif ve lisans

Telif Hakkı (c) 2026 Nida Akın. Tüm hakları saklıdır. Kapalı kaynak yazılımdır;
koşullar için [LICENSE](LICENSE), kullanılan açık kaynak bileşenler için
[THIRD-PARTY-NOTICES](THIRD-PARTY-NOTICES) dosyasına bakın (`npm run notices` ile yenilenir).

## Geliştirici

Bu yazılım [PaperAxis](https://paperaxis.com) tarafından geliştirilmiştir.
İletişim: info@paperaxis.com
