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
   - [Pilates (grup dersleri)](#pilates-grup-dersleri)
10. [Güvenlik ve KVKK](#güvenlik-ve-kvkk)
11. [Mobil uygulama](#mobil-uygulama)
12. [API özeti](#api-özeti)
13. [Test](#test)
14. [Üretim derlemesi ve dağıtım](#üretim-derlemesi-ve-dağıtım)
15. [Yedekleme ve veri saklama](#yedekleme-ve-veri-saklama)
16. [Görseller](#görseller)
17. [Yayın öncesi kontrol listesi](#yayın-öncesi-kontrol-listesi)

---

## Teknoloji

| Katman | Seçim |
| --- | --- |
| Uygulama | Next.js 16 (App Router, sunucu tarafı render) · React 19 · TypeScript · Tailwind CSS v4 · Motion · Lucide (yalnızca panelde) |
| API | Hono (Next.js route handler içinde, `/api/*`) · Zod |
| Veritabanı | MySQL 8.0.16+ / MariaDB 10.6+ · Prisma ORM 7 (`@prisma/adapter-mariadb`) |
| Kimlik doğrulama | Sunucu taraflı oturum (HttpOnly + SameSite=Strict cookie) · CSRF token · scrypt parola özeti |
| Şifreleme | AES-256-GCM (görüşme notları, ölçümler, danışan dosyaları, beslenme planları, tarif içerikleri ve varyasyon notları) |
| Saat dilimi | Tüm iş kuralları `Europe/Istanbul`; veritabanında `DATETIME(3)` (UTC) |

Tek bir Node süreci (Next.js) hem sayfaları hem API'yi sunar; Docker gerekmez. Paylaşımlı hostingde cPanel
**Node.js App** ile çalışır (bkz. [Üretim derlemesi ve dağıtım](#üretim-derlemesi-ve-dağıtım)).

## Proje yapısı

```
├── prisma/
│   ├── schema.prisma          # Veritabanı şeması (roller, kullanıcılar, randevular, danışanlar, …)
│   ├── migrations/            # MySQL migration'ları
│   ├── seed.ts                # İlk kurulum verisi (idempotent)
│   └── seed-demo.ts           # Yalnızca DEMO_MODE=true iken örnek veri
├── shared/                    # İstemci + sunucu ortak kodu
│   ├── site-config.ts         # ★ MERKEZİ YAPILANDIRMA (iletişim, sosyal medya, işletme bilgisi — hepsi null)
│   ├── settings.ts            # İçerik şemaları + varsayılan metinler
│   ├── schemas.ts             # Zod doğrulama şemaları (form + API)
│   ├── plan-template.ts       # Beslenme planı A4 şablonu (önizleme + yazdırma)
│   ├── constants.ts           # Durum etiketleri, sabitler
│   ├── seed-content.ts        # Hizmet / blog / SSS taslakları
│   └── time.ts                # Europe/Istanbul tarih yardımcıları
├── server/                    # Sunucu kodu (yalnızca Node'da çalışır)
│   ├── app.ts                 # API uygulaması (Hono): oturum, hız sınırı, hata yakalama, route'lar
│   ├── jobs.ts                # Periyodik işler (oturum temizliği, randevu hatırlatıcıları)
│   ├── auth/                  # Oturum, CSRF, rol-izin eşlemesi
│   ├── routes/                # REST uç noktaları (modül başına bir dosya)
│   ├── services/              # Müsaitlik/çakışma, randevu iş kuralları, bildirimler, e-posta, yazdırma sayfası
│   ├── lib/                   # env, db, crypto, audit, storage, http yardımcıları
│   └── seo.ts                 # Sayfa meta bilgisi, robots.txt, sitemap.xml
├── src/
│   ├── app/                   # Next.js App Router: sayfalar, layout'lar, /api, /uploads, robots, sitemap
│   ├── proxy.ts               # Sayfa istekleri için CSP (istek başına nonce)
│   ├── instrumentation.ts     # Sunucu açılışında periyodik işleri başlatır
│   ├── views/                 # Sayfa bileşenleri (herkese açık + views/panel/* + views/portal/*)
│   ├── components/            # layout, navigation, sections, cards, forms, ui, icons, panel, portal, seo, motion
│   ├── data/                  # SiteContext (panelden yönetilen içerik)
│   ├── lib/router.tsx         # Link / useNavigate / useParams … (next/navigation üzerinde)
│   ├── config/ hooks/ styles/
├── mobile/                    # iOS + Android uygulaması (Expo) — danışan ve panel girişi
├── scripts/                   # create-admin, reset-password, retention, backup, migrate-pg-to-mysql, prepare-images
├── public/                    # Statik dosyalar: görseller (AVIF + WebP), favicon, yazdırma fontları
└── assets-src/                # Kaynak görseller
```

## Hızlı kurulum (geliştirme)

Gereksinimler: Node.js ≥ 20.19 (önerilen 22), MySQL 8.0.16+ veya MariaDB 10.6+, (görseller için isteğe bağlı) Python 3 + Pillow.

```bash
# 1) Bağımlılıklar
npm install

# 2) Ortam değişkenleri
cp .env.example .env
# DATA_ENCRYPTION_KEY üretin ve .env'e yazın:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# 3) Veritabanı (örnek; utf8mb4 şart)
mysql -u root -p -e "CREATE DATABASE nidaakin CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  CREATE USER 'nida'@'localhost' IDENTIFIED BY 'nida_dev_pw';
  GRANT ALL ON nidaakin.* TO 'nida'@'localhost';"

# 4) Şema + istemci + ilk veriler
npx prisma migrate deploy     # (geliştirmede şema değiştirirseniz: npm run db:migrate)
npx prisma generate
npm run db:seed

# 5) Yönetici hesabı (etkileşimli; şifre ekrana yazılmaz)
npm run admin:create

# 6) Çalıştır
npm run dev                   # Site: http://localhost:3000  ·  Panel: http://localhost:3000/panel
```

`npm run db:migrate` (yeni migration üretme) gölge veritabanı açtığı için veritabanı kullanıcısının
`CREATE DATABASE` yetkisi olmalıdır; paylaşımlı hostingde yalnızca `db:deploy` kullanılır.

## Ortam değişkenleri

Tam liste ve açıklamalar `.env.example` içindedir.

| Değişken | Zorunlu | Açıklama |
| --- | --- | --- |
| `DATABASE_URL` | ✔ | MySQL/MariaDB bağlantı adresi: `mysql://kullanici:sifre@sunucu:3306/veritabani` (şifredeki özel karakterler URL kodlu) |
| `DATA_ENCRYPTION_KEY` | ✔ | 32 baytlık base64 anahtar. Klinik veriler bununla şifrelenir. **Kaybedilirse veri çözülemez; değiştirilirse eski veri okunamaz.** Yedeklerden ayrı, güvenli bir kasada saklayın. |
| `PUBLIC_SITE_URL` | ✔ (üretim) | Canonical, sitemap, Open Graph ve e-posta bağlantıları için kök adres (ör. `https://nidaakin.com`) |
| `NODE_ENV` | | `production` iken cookie'ler `Secure` olur, CSP sıkılaşır |
| `PORT` | | Varsayılan 3000 (cPanel Node.js App kendisi atar) |
| `TRUST_PROXY` | | Ters vekil arkasında `1` (gerçek istemci IP'si → hız sınırlama doğru çalışır) |
| `SESSION_TTL_HOURS` / `SESSION_REMEMBER_DAYS` | | Oturum süreleri (varsayılan 12 saat / "Beni hatırla" 30 gün) |
| `UPLOAD_DIR` | ✔ (üretim) | Yüklemeler (varsayılan `./storage`). Üretimde uygulama klasörünün **dışında mutlak bir yol** verin (derlemede silinmesin). `private/` alt klasörü şifreli danışan dosyalarıdır, asla statik servis edilmez |
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
`blog_posts`, `faqs`, `media_assets`, `website_settings`, `nutrition_plans`, `recipes`, `audit_logs`,
`client_accounts`, `client_account_tokens`, `client_sessions`, `client_messages`, `app_locks`.

Randevu yazımları `app_locks` tablosundaki satır kilidiyle (`INSERT … ON DUPLICATE KEY UPDATE`, `READ COMMITTED`
transaction) serileştirilir: aynı anda gelen iki onay/oluşturma isteği aynı boşluğu kapatamaz. `appointments_time_order`
CHECK kısıtı bitişin başlangıçtan sonra olmasını veritabanı seviyesinde de zorunlu kılar.

**PostgreSQL'den geçiş:** Eski (PostgreSQL) kurulumdaki veriler `npm run data:migrate-pg` ile yeni MySQL
veritabanına birebir kopyalanır; adımlar için [docs/DEPLOY.md](docs/DEPLOY.md#postgresqlden-mysqle-geçiş-tek-seferlik).

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

## Beslenme planları (A4, yazdır / PDF)

**Panel → Beslenme Planları** veya **Danışan → Beslenme Planları** sekmesi.

- Plan; başlık, su hedefi (bardak takip kutucukları), hareket hedefi (haftanın günleri), en fazla 7 öğün × 3 seçenek,
  alışkanlıklar kutusu, porsiyon tablosu, alt not ve imzadan oluşur. Düzen, diyetisyenin örnek planını temel alır.
- Danışan seçilince başlık Türkçe ekle otomatik oluşur (“Ömer’in / Ayşe’nin / Nida’nın beslenme planı”).
- **Şablonlar:** Danışana bağlı olmayan listeler. Kurulumda örnek plandan oluşturulan “1. ay, 1. liste” şablonu gelir;
  yeni planlar bir şablondan kopyalanarak başlar. Her plan “Şablon olarak kaydet” ile şablona dönüştürülebilir.
- **Canlı önizleme** yazdırma sayfasıyla aynı şablonu kullanır (`shared/plan-template.ts`). İçerik uzarsa tüm ölçüler orantılı
  küçültülerek **tek A4 sayfaya sığdırılır**; yazı %85'in altına inerse uyarı verilir, sığmazsa (%72 sınırı) önizlemede bildirilir.
- **Yazdır / PDF:** Sunucuda PDF üretilmez (Chromium gerekmez). Plan, aynı şablonla bağımsız bir A4 yazdırma sayfası
  olarak yeni sekmede açılır ve yazdırma penceresi gelir; **“PDF olarak kaydet”** seçilerek PDF alınır (kenar boşlukları:
  Yok, arka plan grafikleri: Açık). Yazı tipi sayfaya gömülüdür, sayfa dış kaynak yüklemez; tek betiği nonce'lu sıkı
  CSP ile çalışır. Danışanlar da Hesabım → Listelerim'den aynı şekilde yazdırır.
- Plan içerikleri sağlık verisi niteliği taşıyabileceğinden **şifreli** saklanır; yalnızca klinik yetkili roller erişir,
  görüntüleme ve yazdırma denetim kaydına yazılır.

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
- **Yazdırma:** 1. sayfa plan olarak kalır (altyazıda “Tarif önerileri sonraki sayfada.” notu çıkar); tarifler fotoğraflarıyla
  ek A4 sayfalara **otomatik dağıtılır** (sığdığı kadar sayfa başına, genelde 2 tarif). Tek başına sayfayı aşan uzun bir
  tarif %70'e kadar küçültülür; yine sığmazsa önizlemede ve indirmede uyarı verilir. Canlı önizleme tüm sayfaları gösterir.
- Planlar tarife **referansla** bağlanır: tarif sonradan düzenlenirse planlar güncel hâliyle basılır; silinen tarif
  planlarda “silinmiş” olarak işaretlenir ve basılmaz.
- **Şifreleme:** kişiye özel tarifler sağlık bilgisi içerebildiği için (“Glutensiz …”, “laktozsuz süt”) **tüm tariflerde**
  ad, kısa açıklama, malzemeler, adımlar ve ipucu tek bir alanda (`recipes.contentEnc`), **varyasyon notu** ayrı bir alanda
  (`recipes.variantNoteEnc`) **AES-256-GCM ile şifreli** saklanır (`DATA_ENCRYPTION_KEY`). Bir tarif sonradan danışana
  bağlansa da bağlantısı kaldırılsa da düz metin geride kalmaz. Yayındaki tarifler sitede gösterilirken çözülür.
  Kategori, porsiyon, süreler, kalori, fotoğraf ve yayın bilgisi düz kalır (sıralama/süzme için; sağlık bilgisi değildir).
  Panel araması, içerik çözüldükten sonra sunucu belleğinde yapılır.
- **Eski kurulumlardan geçiş:** anahtar yalnızca uygulamada olduğu için düz metinden şifreliye taşıma uygulama açılışında,
  sunucu istek almaya başlamadan önce yapılır (idempotent). İlgili migration'lar düz metin sütunlarını yalnızca içlerinde
  taşınmamış veri yoksa siler; aksi hâlde uygulama önce şifreleyip sonra sütunları kendisi kaldırır — hangi sürümden
  güncellenirse güncellensin veri kaybı olmaz. Taşınan kayıt varsa günlükte “✓ N tarifin içeriği şifrelendi” görünür.
- Erişim planlarla aynı izinlerle (klinik yetkili roller) sınırlıdır; ekleme/düzenleme/silme, yayınlama/yayından kaldırma
  denetim kaydına yazılır.

### Web sitesinde yayınlama

- Tarif formundaki **“Web sitesinde yayınla”** anahtarı açık olan tarifler sitede **/tarifler** (kategori süzgeçli liste)
  ve **/tarifler/&lt;adres&gt;** (malzemeler, adımlar, künye, ipucu, “genel öneridir” uyarısı) altında görünür.
  Diğerleri yalnızca panelde ve planlarda kalır.
- Yayınlanmış en az bir tarif varsa üst menüye ve alt bilgiye **“Tarifler”** bağlantısı kendiliğinden eklenir; ana sayfada
  “Süreç” bölümünden sonra **“Mutfaktan”** şeridi görünür (yayınlanmış tarif yoksa hiç çizilmez).
- **Ana sayfada hangi tariflerin görüneceği panelden seçilir:** Panel → Tarifler'in üstündeki **“Ana sayfada gösterilenler”**
  kutusundan (ekle / çıkar) ya da tarif formundaki **“Ana sayfada göster”** anahtarıyla. En fazla 3 tarif, eklenme sırasıyla
  görünür; yalnızca yayındaki ve kişiye özel olmayan tarifler seçilebilir, yayından kaldırılan tarif ana sayfadan da çıkar.
  Hiç seçim yoksa son yayınlanan 3 tarif otomatik gösterilir.
- Bölümün **başlığı, alt metni ve “Tüm tarifler” bağlantı metni** Panel → Web Sitesi İçeriği → Ana Sayfa → **Tarifler bölümü**
  formundan düzenlenir (varsayılan: “Mutfaktan”).
- Adres (slug) ilk yayında başlıktan üretilir ve sonradan **değişmez**; başlık düzeltilse de paylaşılan bağlantılar kırılmaz.
  Yayından kaldırılan tarifin sayfası 404 döner ve site haritasından çıkar.
- SEO: site haritasında yer alır; sunucu tarafı meta + **Schema.org `Recipe`** (malzemeler, adımlar, süreler, porsiyon,
  kalori, görsel) yazılır. Herkese açık uç danışan, ana tarif veya yazar bilgisi döndürmez.

### Varyasyonlar ve kişiye özel tarifler

- Bir tarifi açıp **“Varyasyon oluştur”** ile kopyasından yeni bir tarif hazırlanır (fotoğraf da kopyalanır); kısa bir
  **varyasyon notu** (“Laktozsuz süt ve peynirle”) yazılır. Ana tarif değişmez; varyasyonun varyasyonu da kök tarife bağlanır.
- Varyasyon bir **danışana bağlanabilir** (kişiye özel). Kişiye özel tarifler:
  - **asla yayınlanamaz** (sunucu reddeder),
  - yalnızca o danışanın planlarında tarif seçicide görünür, çıktıda tarif adının altında **“Sana özel.”** notuyla basılır,
  - danışan profilinde (Beslenme Planları sekmesi) listelenir,
  - danışan silindiğinde (panelden veya saklama süresi betiğiyle) fotoğraflarıyla birlikte **silinir**.
- **Plan düzenleyiciden hızlı uyarlama:** danışan planındaki bir tarifin yanındaki dal simgesi (“Ayşe için uyarla”)
  varyasyon formunu o danışan seçili olarak açar; kaydedilince plandaki tarif bu kişiye özel versiyonla değiştirilir.
- Panel → Tarifler'de **Tümü / Genel / Sitede yayında / Kişiye özel** sekmeleri ve kartlarda rozetler vardır;
  `?danisan=<id>` bir danışanın, `?ana=<id>` bir tarifin varyasyonlarını süzer.

## Randevu sistemi nasıl çalışır

1. Ziyaretçi web sitesinde gün/saat seçer (yalnızca çalışma saatleri, kapalı günler, öğle arası, minimum ön süre ve
   mevcut randevular düşülerek hesaplanan **gerçek boş dilimler** gösterilir) veya saat seçmeden iletişim talebi bırakır.
2. Talep doğrulanır, kaydedilir; durum **"Onay Bekliyor"** (saatsiz taleplerde **"Yeni Talep"**). Ziyaretçiye
   **sahte bir onay gösterilmez**; talebin incelendiği ve iletişime geçileceği söylenir.
3. Panelde bildirim oluşur, bildirim sayacı ve dashboard güncellenir.
4. Diyetisyen onaylar / reddeder / tarihi-saati değiştirir. Onay ve saat değişikliğinde çakışma kontrolü
   **satır kilidi (`app_locks`) + transaction** içinde yeniden yapılır.
5. Onaylanan talep, telefon/e-posta ile eşleşen danışana bağlanır; yoksa danışan kaydı oluşturulur.
6. Yaklaşan (24 saat içindeki) onaylı randevular için sunucu her 5 dakikada bir hatırlatma bildirimi üretir.

Durumlar: Yeni Talep · Onay Bekliyor · Onaylandı · Tamamlandı · İptal Edildi · Gelmedi — her değişiklik
`appointment_status_history` tablosuna yazılır.

### Pilates (grup dersleri)

Panel → **Pilates** (`/panel/pilates`). Yetki randevularla aynıdır (`appointments:read/write`), asistan da yönetebilir;
sağlık verisi tutulmaz, yalnızca katılım bilgisi.

- **Grup:** sabit üyeler + kontenjan (varsayılan **3 kişi**, en fazla 12) + ders süresi. Üye sayısı kontenjanı aşamaz.
- **Ders programı:** gruba gün/saat (ör. Salı 18:00, Perşembe 19:00) ve hafta sayısı (≤ 26) seçilir; dersler tek seferde
  açılır, üyeler otomatik katılımcı olur. Dolu/kapalı güne denk gelen tarihler **atlanır ve nedeniyle listelenir**.
- **Tek ders:** gruptan veya grupsuz (deneme / telafi / özel ders).
- **Yoklama:** Katıldı · Gelmedi · Haber verdi. "Haber verdi" kontenjandan düşer; boşalan yere telafi/misafir danışan
  eklenebilir. "Ders yapıldı" işaretlenince işaretlenmemiş kayıtlar "katıldı" sayılır. Gelecek ders "katıldı" yapılamaz.
- **Üyelik değişikliği:** gruptan çıkan kişi planlı derslerden çıkarılır, yeni üye yer olan derslere eklenir (isteğe bağlı).
- **Takvim:** planlı/yapılmış dersler zaman kaplar — randevu takviminde mavi bloklar olarak görünür, web sitesindeki boş
  saatlerden düşülür ve randevularla aynı kilit altında çakışma kontrolüne girer. Randevu ↔ ders arasında günün dinlenme
  süresi uygulanır; ders ↔ ders arasında yalnızca örtüşme engellenir (art arda dersler mümkün).
- **Danışan:** danışan detayında "Pilates" sekmesi (grup, yaklaşan/geçmiş dersler, devam oranı); danışan hesabında
  (Hesabım → Randevular) yalnızca kendi dersleri görünür — diğer katılımcıların adı gösterilmez. KVKK dışa aktarımına dahildir.

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
- Danışan detayında **verileri dışa aktar** (md. 11 erişim talebi) ve **kalıcı silme / anonimleştirme**. Dışa aktarma JSON'u
  kimlik ve randevu bilgilerini, dosya listesini; klinik yetkili kullanıcıda ayrıca görüşme notlarını, ölçümleri,
  **beslenme planlarını** (`nutritionPlans`: çözülmüş plan içeriği, plana eklenen tariflerin adı ve etiketi) ve
  **kişiye özel tarifleri** (`personalRecipes`: çözülmüş varyasyon notu, dayandığı ana tarif, malzemeler, adımlar, görsel yolu) içerir.
- `npm run data:retention` — saklama süresi dolan pasif danışanları anonimleştirir (`--dry-run` ile önizleme).
- Yasal metinler (`/kvkk-aydinlatma-metni`, `/acik-riza-metni`, `/gizlilik-politikasi`, `/cerez-politikasi`) **taslaktır**.

> ⚠️ Bu yazılım KVKK uyumluluğunu **otomatik olarak sağlamaz**. Aydınlatma ve açık rıza metinleri, veri işleme
> envanteri, VERBİS yükümlülüğü, saklama-imha politikası ve yurt dışı aktarım (barındırma/e-posta sağlayıcısı)
> değerlendirmesi yayın öncesinde bir hukuk uzmanı tarafından yapılmalıdır.

## Mobil uygulama

`mobile/` klasöründe **iOS ve Android** için tek bir Expo (React Native) uygulaması vardır: açılışta
**Danışan girişi** (Hesabım) ya da **Nida Akın & ekip** (Panel) seçilir. Web panelinin ve Hesabım'ın tüm
özellikleri mobilde de bulunur; aynı API'yi kullanır. Kurulum, derleme (EAS) ve geliştirme kuralları:
[mobile/README.md](mobile/README.md).

**Mobil oturum (API):** tarayıcı cookie kullanır; mobil uygulama cookie kullanmaz. Giriş isteği
`X-App-Client: mobile` başlığını taşırsa (`POST /api/auth/login`, `POST /api/portal/auth/login`,
`POST /api/portal/auth/set-password`) yanıt gövdesinde `{ token, csrfToken, expiresAt }` döner ve cookie yazılmaz.
Sonraki isteklerde `Authorization: Bearer <token>` gönderilir; durum değiştiren isteklerde `X-CSRF-Token`
mobilde de zorunludur. Mobil oturumlar "beni hatırla" süresiyle (`SESSION_REMEMBER_DAYS`) açılır; veritabanında
yine yalnızca token özeti tutulur. Şifre değişikliği tüm oturumları kapatır ve yanıtta yeni token döner.
Personel token'ı danışan uçlarını, danışan token'ı personel uçlarını açmaz (`tests/mobile-auth.integration.test.ts`).

## API özeti

Tüm yanıtlar JSON'dur. Hatalar: `{ "error": { "code", "message", "details"? } }` — doğrulama hatalarında
`details.fields` alan bazlı Türkçe mesajlar içerir (HTTP 422). Çakışmalar HTTP 409 döner.

<!-- api:start -->
**Kimlik doğrulama** (`/api/auth`)

| Yöntem | Yol | Açıklama |
| --- | --- | --- |
| POST | `/login` | `{ email, password, remember }` → oturum cookie'si (mobil uygulamada token, bkz. [Mobil uygulama](#mobil-uygulama)). 401 hatalı bilgi · 423 hesap kilitli · 429 hız sınırı |
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
| Beslenme planları | `GET/POST /api/plans` (`?clientId`, `?templates=1`) · `GET/PATCH/DELETE /:id` · `GET /:id/print` (A4 yazdırma sayfası, `?autoprint=1`) |
| Tarifler | `GET/POST /api/recipes` (`?category`, `?q`, `?clientId`; POST'ta `parentId`, `copyImage`) · `GET/PATCH/DELETE /:id` · `POST/DELETE /:id/image` · `PUT /:id/featured` |
| Tarifler (herkese açık) | `GET /api/public/recipes` (`?category`, `?limit`) · `GET /api/public/recipes/home` · `GET /api/public/recipes/:slug` |
| Pilates (grup dersleri) | `GET/POST /api/classes/groups` · `GET/PATCH/DELETE /groups/:id` · `PUT /groups/:id/members` · `POST /groups/:id/recurring` · `GET/POST /api/classes/sessions` (`?from&to&groupId&clientId&includeCancelled`) · `GET/PATCH/DELETE /sessions/:id` · `POST /sessions/:id/status` · `POST /sessions/:id/attendees` · `PATCH/DELETE /sessions/:id/attendees/:clientId` · `GET /clients/:clientId` |
| Denetim kaydı | `GET /api/audit-logs` · `GET /facets` |
<!-- api:end -->

## Test

```bash
npm test               # vitest: birim testleri + API entegrasyon testleri (MySQL/MariaDB veritabanı ve yönetici hesabı gerekir)
npm run typecheck      # tüm proje tip kontrolü
```

## Üretim derlemesi ve dağıtım

> Çalışan bir siteyi **güncellemek** için adım adım kontrol listesi (yedek, migration, doğrulama, geri dönüş):
> [docs/DEPLOY.md](docs/DEPLOY.md).
>
> **Otomatik dağıtım:** `main`'e birleştirilen her değişiklik GitHub Actions ile test edilir, derlenir ve SSH ile
> canlıya alınır (yedek + migration + sürüm doğrulama + başarısızlıkta otomatik geri dönüş). Kurulum:
> [docs/DEPLOY.md → Otomatik dağıtım](docs/DEPLOY.md#otomatik-dağıtım-github-actions).

Docker gerekmez. Derleme `.next/standalone/` altında **tek başına çalışan** bir klasör üretir (`server.js` +
yalnızca gereken `node_modules` + `public/` + `.next/static/`).

```bash
npm ci
npm run build          # Next.js derlemesi → .next/standalone/  +  CLI betikleri → dist-scripts/
npm run db:deploy      # bekleyen migration'lar
npm run prod:seed      # yalnızca ilk kurulumda
npm run prod:admin:create
npm start              # = node .next/standalone/server.js  (PORT, varsayılan 3000)
```

**cPanel (Hosting Dünyam vb.) — "Setup Node.js App":**

1. cPanel → **MySQL Databases**: veritabanı + kullanıcı oluşturun, kullanıcıya tüm yetkileri verin
   (karakter seti utf8mb4 / `utf8mb4_unicode_ci`).
2. Kodu sunucuya alın (Git Version Control veya dosya yükleme), terminalde `npm ci && npm run build`
   (ya da derlemeyi kendi bilgisayarınızda yapıp `.next/standalone/` klasörünü yükleyin).
3. **Setup Node.js App**: Node.js 22 · Application mode: Production · Application root: projenin klasörü ·
   Startup file: `app.cjs` (standalone sunucuyu başlatan küçük CommonJS dosyası).
4. Ortam değişkenlerini aynı ekrandan girin: `NODE_ENV=production`, `DATABASE_URL`, `DATA_ENCRYPTION_KEY`,
   `PUBLIC_SITE_URL`, `TRUST_PROXY=1`, `UPLOAD_DIR=/home/KULLANICI/nidaakin-storage` (uygulama klasörünün dışında),
   isteğe bağlı `SMTP_*`.
5. Terminalde `npm run db:deploy`, ilk kurulumda `npm run prod:seed` ve `npm run prod:admin:create`; ardından
   **Restart**.

Ayrıntılı güncelleme adımları, yedek ve geri dönüş: [docs/DEPLOY.md](docs/DEPLOY.md).

**Kendi sunucunuzda (VPS):** `node .next/standalone/server.js`'i systemd/pm2 ile çalıştırın, önüne HTTPS'li bir ters
vekil koyun ve `TRUST_PROXY=1` ayarlayın:

```
nidaakin.com {
  encode zstd gzip
  reverse_proxy 127.0.0.1:3000
}
```

**Kontrol listesi:** `NODE_ENV=production` · HTTPS · `PUBLIC_SITE_URL` doğru · güçlü veritabanı şifresi ·
`DATA_ENCRYPTION_KEY` kasada · `UPLOAD_DIR` uygulama klasörü dışında, kalıcı diskte · düzenli yedek · SMTP (isteğe bağlı) ·
periyodik `prod:data:retention` (ör. cPanel → Cron Jobs, ayda bir).

## Yedekleme ve veri saklama

```bash
npm run backup                 # mysqldump (gzip) + storage/ arşivi → ./backups (izinler 600)
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
