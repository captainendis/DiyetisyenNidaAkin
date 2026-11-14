# Canlıya alma (deploy)

Bu belge, **çalışan bir siteyi güncellemek** ve **eski (PostgreSQL + Docker) kurulumdan yeni yapıya geçmek** içindir.
İlk kurulum için README → [Üretim derlemesi ve dağıtım](../README.md#üretim-derlemesi-ve-dağıtım) bölümüne bakın.

> ⚠️ **Dal:** Canlıya alınacak kod deponun **varsayılan dalındadır** (GitHub'da deponun ana sayfasında seçili olan dal).
> Sunucunun hangi daldan çektiğini kontrol edin; eski kalmış bir daldan çekilirse güncellemeler gelmez.

Yapı: **Next.js** (sayfalar + `/api`) tek Node süreci · **MySQL 8 / MariaDB** · Docker ve Chromium **gerekmez**.
Paylaşımlı hostingde cPanel **Setup Node.js App** ile çalışır (Startup file: `app.cjs`).

> 🤖 **Otomatik dağıtım kuruluysa** (aşağıdaki bölüm) bu belgedeki 1–3. adımları GitHub Actions sizin yerinize yapar:
> `main` dalına her birleştirmede test → yedek → migration → yeni sürüm → doğrulama. Elle güncelleme yalnızca yedek yöntemdir.

---

## Otomatik dağıtım (GitHub Actions)

### Nasıl çalışır

```
main'e push / PR birleştirme
  └─ CI (.github/workflows/ci.yml)  tip kontrolü · MariaDB'ye karşı tüm testler · şema↔migration uyumu · üretim derlemesi
  └─ Deploy işi siteyi derler ve paketler: .next/standalone + dist-scripts + prisma  (.env ASLA pakete girmez)
  └─ Deploy (.github/workflows/deploy.yml)  SSH ile sunucuya yükler ve scripts/deploy-remote.sh'ı çalıştırır:
       1. kilit (aynı anda tek dağıtım)
       2. DATA_ENCRYPTION_KEY parmak izi kontrolü — anahtar değişmişse DURUR
       3. yedek (veritabanı + dosyalar → backups/, son 14 tanesi saklanır)
       4. prisma CLI bağımlılıkları (yalnızca package-lock.json değiştiyse npm ci)
       5. migration (prisma migrate deploy) — hata olursa DURUR, canlı site eski sürümde kalır
       6. yeni derlemeye geçiş (eski derleme .deploy/previous/ altında saklanır) + yeniden başlatma
  └─ Doğrulama: https://alanadiniz/api/health yeni commit'i gösterene kadar bekler (5 dk)
       └─ göstermezse kod otomatik olarak önceki sürüme döner
```

Derleme **sunucuda yapılmaz** (paylaşımlı hostingde bellek sınırı sorunu ortadan kalkar). Testler geçmeyen kod
canlıya çıkmaz. PR'larda ve diğer dallarda yalnızca CI çalışır.

### Bir kerelik kurulum

> **Kısa yol:** Adım 1–4'ü sunucuda tek komutla yapabilirsiniz: `scripts/server-setup.sh` dosyasını sunucuya kopyalayıp
> `bash server-setup.sh` çalıştırın. Anahtarı üretir ve yetkilendirir, `.env`'i cPanel değişkenlerinden oluşturur,
> parmak izini alır ve GitHub'a girilecek tüm değerleri ekrana yazar. Ardından yalnızca adım 5 kalır.

**1. Sunucuda SSH erişimi.** cPanel → **SSH Access** (Hosting Dünyam'da paket SSH içermiyorsa destekten açtırın).

**2. Dağıtım anahtarı** (kendi bilgisayarınızda; parola koymayın — GitHub Actions kullanacak):

```bash
ssh-keygen -t ed25519 -C "github-deploy" -f nidaakin_deploy -N ""
```

- `nidaakin_deploy.pub` → cPanel → SSH Access → **Manage SSH Keys → Import Key** → ardından **Authorize**.
- `nidaakin_deploy` (gizli anahtar) → GitHub'a (adım 5). Sonra bilgisayarınızdan silebilirsiniz.

**3. Sunucu parmak izi** (ortadaki-adam saldırısına karşı; bilgisayarınızda):

```bash
ssh-keyscan -p SSH_PORTU sunucu.alanadi.com
```

Çıktıyı cPanel → SSH Access'te görünen parmak iziyle karşılaştırın; tüm satırları adım 5'te `DEPLOY_KNOWN_HOSTS`'a yapıştırın.

**4. Sunucuda `.env`.** Uygulama kökünde (cPanel "Application root") bir `.env` dosyası oluşturun ve
**Setup Node.js App'teki değişkenlerin aynısını** yazın (`DATABASE_URL`, `DATA_ENCRYPTION_KEY`, `PUBLIC_SITE_URL`,
`UPLOAD_DIR`, `TRUST_PROXY`, `SMTP_*`…). Dağıtım betiği migration ve yedek için bu dosyayı okur; site de aynı
dosyayı görür. İzinleri kısıtlayın: `chmod 600 .env`. Bu dosya git'e ve CI'a **hiç girmez**.

**5. GitHub ayarları** — depo → Settings → Secrets and variables → Actions:

| Tür | Ad | Değer |
| --- | --- | --- |
| Secret | `DEPLOY_SSH_KEY` | Adım 2'deki gizli anahtarın tamamı (`-----BEGIN OPENSSH PRIVATE KEY-----` …) |
| Secret | `DEPLOY_KNOWN_HOSTS` | Adım 3'teki `ssh-keyscan` çıktısı |
| Secret | `DEPLOY_HOST` | SSH sunucusu (ör. `sunucu.alanadi.com`) |
| Secret | `DEPLOY_USER` | cPanel kullanıcı adı |
| Secret | `DEPLOY_PORT` | SSH portu (boşsa 22) |
| Variable | `DEPLOY_PATH` | Uygulama kökü, mutlak yol (ör. `/home/KULLANICI/nidaakin`) |
| Variable | `SITE_URL` | `https://alanadiniz` (doğrulama için) |
| Variable | `DEPLOY_NODE_ACTIVATE` | cPanel: `/home/KULLANICI/nodevenv/nidaakin/22/bin/activate` (Setup Node.js App sayfasının üstündeki komutta görünen yol). VPS'te boş |
| Variable | `DEPLOY_RESTART_CMD` | cPanel'de **boş bırakın** (Passenger `tmp/restart.txt` ile yeniden başlar). VPS: ör. `pm2 reload nidaakin` |
| Variable | `DEPLOY_ENABLED` | Her şey hazır olunca `true` — bu olmadan hiçbir şey sunucuya gönderilmez |

İsteğe bağlı: Settings → Environments → **production** → *Required reviewers* eklerseniz her dağıtım sizin
onayınızı bekler (otomatik yerine "tek tıkla" dağıtım).

**6. İlk dağıtım:** Actions → **Deploy** → *Run workflow* (`deploy`). İlk çalıştırmada anahtar parmak izi kaydedilir
ve `npm ci` yapılır (birkaç dakika). Sonrakiler genelde 1–2 dakika sürer.

> Sunucuda daha önce cPanel **Git Version Control** ile çekilmiş bir kopya varsa sorun değildir; dağıtım yalnızca
> `.next/`, `dist-scripts/`, `prisma/`, `package*.json`, `app.cjs` ve `scripts/` altındaki iki betiği günceller.
> Otomatik dağıtıma geçtikten sonra sunucuda `git pull` / `npm run build` yapmayın.

### Günlük kullanım

- **Güncelleme:** PR'ı `main`'e birleştirin — gerisi otomatik. İlerleme: GitHub → Actions → Deploy.
- **Geri dönüş:** Actions → Deploy → *Run workflow* → `rollback`. Ya da sunucuda:
  `APP_ROOT=$PWD bash scripts/deploy-remote.sh rollback` (önce `source <NODE_ACTIVATE yolu>`).
  Yalnızca **kod** geri alınır; veritabanı için aşağıdaki **5. Geri dönüş** adımını ve `backups/` altındaki
  dağıtım öncesi yedeği kullanın. Son 3 derleme saklanır.
- **Durum:** sunucuda `APP_ROOT=$PWD bash scripts/deploy-remote.sh status` · tarayıcıda `/api/health` → `revision`.

### Bir şey ters giderse

| Belirti | Neden / çözüm |
| --- | --- |
| `DATA_ENCRYPTION_KEY değişmiş!` | `.env`'deki anahtar ilk dağıtımdakinden farklı. Doğru anahtarı geri koyun. Anahtarı bilerek değiştirmediyseniz `.deploy/key.sha256`'yı **silmeyin**. |
| Migration hatası (`P3018` vb.) | Site eski sürümde çalışmaya devam eder. Hatayı düzeltin; Prisma başarısız migration'ı kaydettiği için sunucuda `npx prisma migrate resolve --rolled-back <migration_adı>` gerekebilir. MySQL'de DDL transaction içinde çalışmaz; yarım kalan değişiklik varsa yedekten dönün. |
| İlk dağıtım uzun sürüyor (`npm ci`) | Paylaşımlı hostingde ilk kurulum 10–20 dk sürebilir; sonraki dağıtımlarda atlanır. Sunucudaki iş SSH'tan bağımsız arka planda çalışır: GitHub işi kesilse de sunucuda tamamlanır. Canlı günlük: `tail -f .deploy/logs/<commit>.log` (çıkış kodu `<commit>.log.exit`). |
| `Başka bir dağıtım sürüyor` | Önceki dağıtım bitmeden ikincisi başladı; Actions zaten sıraya koyar. Elle çalıştırmada bekleyin. |
| Doğrulama zaman aşımı → otomatik geri dönüş | cPanel → Setup Node.js App → `stderr.log`'a bakın (çoğunlukla eksik ortam değişkeni). |
| `Eksik ayar: …` | Adım 5'teki secret/variable eksik. |

---

## 0. Başlamadan önce

- [ ] Sunucudaki ortam değişkenlerinde (cPanel → Setup Node.js App → Environment variables ya da `.env`)
      **`DATA_ENCRYPTION_KEY` değişmeyecek.** Bu anahtar değişirse beslenme planları, görüşme notları, ölçümler,
      danışan dosyaları ve tarifler okunamaz hâle gelir.
- [ ] Anahtarın bir kopyası veritabanı yedeğinden **ayrı**, güvenli bir yerde duruyor.
- [ ] `UPLOAD_DIR` uygulama klasörünün **dışında** mutlak bir yol (ör. `/home/KULLANICI/nidaakin-storage`).
      Göreli yol (`./storage`) derleme klasörünün içine düşer ve yeniden derlemede kaybolabilir.

## 1. Yedek al (atlamayın)

Güncellemeler veritabanında tablo ve sütun ekleyip kaldırabilir; geri dönmenin tek güvenli yolu bu yedektir.

```bash
cd /uygulama/klasoru
npm run backup
# → backups/db-TARİH.sql.gz ve backups/storage-TARİH.tar.gz
```

cPanel'de alternatif: **Backup → Download a MySQL Database Backup** + `UPLOAD_DIR` klasörünü **File Manager → Compress**.
Yedekler kişisel veri içerir: erişimi kısıtlı, şifreli bir yerde saklayın; `DATA_ENCRYPTION_KEY` ile aynı yerde tutmayın.

## 2. Kodu güncelle

```bash
git rev-parse HEAD      # ← çıktıyı not edin: geri dönüşte bu commit'e dönülür
git fetch origin
git checkout <varsayılan-dal>
git pull origin <varsayılan-dal>
git log --oneline -1    # beklenen son commit'i görün
```

(cPanel → **Git Version Control** → depo → **Pull or Deploy** → *Update from Remote* da aynı işi yapar.)

## 3. Derle, veritabanını güncelle, yeniden başlat

cPanel'de komutları **Setup Node.js App** sayfasının üstündeki "Enter to the virtual environment" komutuyla açılan
terminalde çalıştırın (doğru Node sürümü ve ortam değişkenleri yüklü gelir).

```bash
npm ci
npm run build            # → .next/standalone/ (çalışan uygulama) + dist-scripts/ (yönetim betikleri)
npm run db:deploy        # bekleyen veritabanı güncellemelerini sırayla uygular
```

`db:deploy` sonunda **"All migrations have been successfully applied."** yazmalı.
Ardından uygulamayı yeniden başlatın: cPanel → Setup Node.js App → **Restart** (VPS'te `pm2 restart …` / `systemctl restart …`).

> Hosting sunucusunda derleme bellek sınırına takılırsa (`JavaScript heap out of memory`), derlemeyi kendi
> bilgisayarınızda yapıp `.next/` klasörünü sunucuya yükleyin; `npm ci` ve `npm run db:deploy` yine sunucuda çalışır.

## 4. Doğrula

**Günlük (log):** cPanel → Setup Node.js App → uygulamanın günlük dosyası (`stderr.log`).

- `… çözülemedi` görürseniz durun: büyük olasılıkla `DATA_ENCRYPTION_KEY` yanlış.
- `Ortam değişkenleri geçersiz` → eksik/yanlış değişken; satırda hangisi olduğu yazar.

**Tarayıcıdan:**

| Kontrol | Beklenen |
| --- | --- |
| `https://alanadiniz/api/health` | `{"ok":true}` |
| Ana sayfa, bir blog yazısı, `/sitemap.xml` | Açılıyor; sayfa kaynağında `<title>` ve açıklama dolu |
| Olmayan bir adres (ör. `/deneme-404`) | "Sayfa bulunamadı" (HTTP 404) |
| Panel → giriş | Giriş yapılabiliyor |
| Panel → **Danışanlar** → bir danışan | Notlar ve ölçümler görünüyor (şifre çözme çalışıyor) |
| Bir beslenme planı → **Yazdır / PDF** | Yeni sekmede A4 sayfa ve yazdırma penceresi açılıyor |
| Danışan → **Verileri dışa aktar** | JSON iniyor |
| Panel → İçerik → bir görsel yükle | Yükleniyor ve sitede görünüyor (`UPLOAD_DIR` yazılabilir) |

## 5. Geri dönüş

Yalnızca eski koda dönmek **yetmez**; veritabanı yeni yapıya geçmiş olabilir. 1. adımdaki yedekle:

```bash
git checkout <güncellemeden-önceki-commit>
gunzip < backups/db-TARİH.sql.gz | mysql -u KULLANICI -p VERITABANI
tar -xzf backups/storage-TARİH.tar.gz -C "$UPLOAD_DIR"
npm ci && npm run build
# uygulamayı yeniden başlatın
```

Güncellemeden sonra panele girilen her şey (randevular, notlar, tarifler) yedekte olmadığı için kaybolur;
sorun varsa geri dönüşü güncellemeden hemen sonra yapın.

---

## PostgreSQL'den MySQL'e geçiş (tek seferlik)

Eski sürüm (Express + Vite, PostgreSQL, Docker, Chromium ile PDF) çalışıyorsa veriler yeni MySQL veritabanına
birebir kopyalanır. **Kaynakta hiçbir şey değiştirilmez**; geçiş başarısız olursa eski site olduğu gibi çalışmaya devam eder.

Geçişten önceki son commit (eski yapı, tüm açık dallar birleşik): `58c209c`.

1. **Eski kurulumu en güncel hâline getirin** (betik bunu denetler): eski sürümde `npm run db:deploy` →
   son migration `20261109000000_client_portal` olmalı. Ardından eski sitenin **yedeğini** alın
   (`pg_dump` + `storage/` arşivi).
2. **Siteyi bakıma alın** (ya da eski uygulamayı durdurun), geçiş süresince yeni veri girilmesin.
3. **MySQL veritabanı açın** (cPanel → MySQL Databases; karakter seti `utf8mb4_unicode_ci`).
4. Yeni kodu alın, ortam değişkenlerini girin: `DATABASE_URL=mysql://…` ve **eski kurulumdaki aynı
   `DATA_ENCRYPTION_KEY`**.
5. Şemayı oluşturun — **seed ve yönetici oluşturmayı çalıştırmayın**, hedef boş olmalı:

   ```bash
   npm ci
   npm run db:deploy
   ```

6. Verileri kopyalayın (PostgreSQL'e bu sunucudan erişilebilmeli; gerekirse SSH tüneli kullanın):

   ```bash
   SOURCE_DATABASE_URL='postgresql://kullanici:sifre@eski-sunucu:5432/nidaakin' npm run data:migrate-pg
   ```

   Her tablo için kopyalanan satır sayısı listelenir; sonda `✓ Taşıma tamamlandı.` yazar. Hata olursa hiçbir şey
   yazılmaz (tek transaction). Hedef boş değilse betik durur; yeniden denemek için `-- --force` ekleyin
   (hedef tabloları boşaltıp yeniden doldurur).

7. **Dosyaları taşıyın:** eski `storage/` klasörünün içeriğini (`public/` ve `private/`) yeni `UPLOAD_DIR`'e kopyalayın
   (Docker'daysa: `docker compose exec -T app tar -czf - -C /app/storage . > storage.tar.gz`).
8. `npm run build`, uygulamayı başlatın ve **4. Doğrula** tablosunu tek tek kontrol edin. Özellikle bir danışanın
   notlarını, bir beslenme planını ve bir danışan dosyasını açın: bunlar açılıyorsa anahtar ve veri doğru taşınmıştır.
9. Alan adını yeni uygulamaya yönlendirin. Eski sunucuyu ve PostgreSQL yedeğini bir süre (ör. 1 ay) silmeyin.

**Değişenler (kullanıcı açısından):**

- Plan PDF'i artık sunucuda üretilmiyor: **Yazdır / PDF** düğmesi planı yeni sekmede A4 olarak açar, yazdırma penceresinde
  **“PDF olarak kaydet”** seçilir (kenar boşlukları: Yok, arka plan grafikleri: Açık). Danışan hesabında da aynı.
- Oturumlar korunur (aynı tablo); kullanıcıların yeniden giriş yapması gerekmez.
- Adresler, panel ve danışan hesabı aynıdır.
