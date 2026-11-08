# Canlıya alma (deploy)

Bu belge, **çalışan bir siteyi güncellemek** içindir. İlk kurulum için README → [Üretim derlemesi ve dağıtım](../README.md#üretim-derlemesi-ve-dağıtım) bölümüne bakın.

> ⚠️ **Dal:** Canlıya alınacak kod deponun **varsayılan dalındadır** (GitHub'da deponun ana sayfasında seçili olan dal).
> Sunucunun hangi daldan çektiğini kontrol edin; eski kalmış bir daldan çekilirse güncellemeler gelmez.

---

## 0. Başlamadan önce

- [ ] Sunucudaki `.env` dosyasında **`DATA_ENCRYPTION_KEY` değişmeyecek.** Bu anahtar değişirse beslenme planları,
      görüşme notları, ölçümler, danışan dosyaları ve tarifler okunamaz hâle gelir.
- [ ] Anahtarın bir kopyası veritabanı yedeğinden **ayrı**, güvenli bir yerde duruyor.
- [ ] Sunucuda Chromium kurulu (plan PDF'leri için). Docker imajı bunu kendisi kuruyor; Docker kullanılmıyorsa
      `.env` içinde `CHROMIUM_PATH` dolu olmalı.
- [ ] Hangi yöntemin kullanıldığını biliyorsunuz: **Docker** (`docker compose`) mı, **doğrudan Node** (`npm start`,
      pm2, systemd, hosting paneli) mi?

## 1. Yedek al (atlamayın)

Güncellemeler veritabanında tablo ve sütun ekleyip kaldırabilir; geri dönmenin tek güvenli yolu bu yedektir.

```bash
cd /uygulama/klasoru
npm run backup
# → backups/db-TARİH.dump ve backups/storage-TARİH.tar.gz
```

Docker'da veritabanı konteynerin içindeyse:

```bash
docker compose exec -T db pg_dump -U nida --format=custom nidaakin > backups/db-$(date +%Y%m%d-%H%M).dump
docker compose exec -T app tar -czf - -C /app/storage . > backups/storage-$(date +%Y%m%d-%H%M).tar.gz
```

Yedekler kişisel veri içerir: erişimi kısıtlı, şifreli bir yerde saklayın; `DATA_ENCRYPTION_KEY` ile aynı yerde tutmayın.

## 2. Kodu güncelle

```bash
git rev-parse HEAD      # ← çıktıyı not edin: geri dönüşte bu commit'e dönülür
git fetch origin
git checkout <varsayılan-dal>
git pull origin <varsayılan-dal>
git log --oneline -1    # beklenen son commit'i görün
```

## 3A. Docker

```bash
docker compose up -d --build app
docker compose logs -f app
```

İmaj açılışta önce veritabanı güncellemelerini (`prisma migrate deploy`), sonra uygulamayı çalıştırır; ayrı bir komut gerekmez.

## 3B. Doğrudan Node

```bash
npm ci
npx prisma generate
npm run build
npm run db:deploy        # bekleyen veritabanı güncellemelerini sırayla uygular
# ardından uygulamayı yeniden başlatın: pm2 restart … / systemctl restart … / hosting panelindeki "yeniden başlat"
```

`db:deploy` sonunda **"All migrations have been successfully applied."** yazmalı.

## 4. Doğrula

**Günlük (log):**

- `✓ API http://localhost:4000 (production)` satırı görünmeli.
- Şifreli alanlara geçiş yapan bir güncellemeden sonra ilk açılışta `✓ N tarifin içeriği şifrelendi` /
  `✓ N tarif varyasyon notu şifrelendi` satırları görünebilir; taşınacak kayıt yoksa görünmez. İkisi de normaldir.
- `… şifrelenemedi` ya da `… çözülemedi` görürseniz durun: büyük olasılıkla `DATA_ENCRYPTION_KEY` yanlış.

**Tarayıcıdan:**

| Kontrol | Beklenen |
| --- | --- |
| `https://alanadiniz/api/health` | `{"ok":true}` |
| Panel → giriş | Giriş yapılabiliyor |
| Panel → **Tarifler** | Sayfa açılıyor |
| Mevcut bir beslenme planı → **PDF indir** | PDF iniyor |
| Danışan → **Verileri dışa aktar** | JSON iniyor |
| Ana sayfa ve `/sitemap.xml` | Açılıyor |

**İsteğe bağlı uçtan uca deneme:** panelden fotoğraflı bir deneme tarifi ekleyin, "Web sitesinde yayınla" ile
yayınlayın; menüde "Tarifler" görünmeli ve sayfa açılmalı. Sonra tarifi silin.

## 5. Geri dönüş

Yalnızca eski koda dönmek **yetmez**; veritabanı yeni yapıya geçmiş olur. 1. adımdaki yedekle:

```bash
git checkout <güncellemeden-önceki-commit>
pg_restore --clean --no-owner -d "$DATABASE_URL" backups/db-TARİH.dump
# Docker'da: docker compose exec -T db pg_restore --clean --no-owner -U nida -d nidaakin < backups/db-TARİH.dump
tar -xzf backups/storage-TARİH.tar.gz -C storage/
# Docker'da: docker compose exec -T app tar -xzf - -C /app/storage < backups/storage-TARİH.tar.gz
npm ci && npx prisma generate && npm run build    # Docker'da: docker compose up -d --build app
# uygulamayı yeniden başlatın
```

Güncellemeden sonra panele girilen her şey (randevular, notlar, tarifler) yedekte olmadığı için kaybolur;
sorun varsa geri dönüşü güncellemeden hemen sonra yapın.

---

## Sürüm notları

### Tarifler (PR #2–#7)

Güncellemeden önceki son commit: `1bd198f` (geri dönüşte kullanılır).

**Veritabanı güncellemeleri (6 adet, sırayla uygulanır):**

| Migration | Ne yapar |
| --- | --- |
| `20261108120000_recipes` | `recipes` tablosu |
| `20261108150000_recipe_publish_variants` | Yayın, adres (slug), varyasyon ve danışan alanları |
| `20261108180000_recipe_featured` | Ana sayfada gösterilecek tarif seçimi |
| `20261108200000_recipe_variant_note_encrypted` | Şifreli varyasyon notu alanı |
| `20261108210000_drop_plain_variant_note` | Eski düz metin not sütununu kaldırır (yalnızca boşsa) |
| `20261108220000_recipe_content_encrypted` | Şifreli tarif içeriği alanı; eski düz metin sütunlarını kaldırır (yalnızca taşınmışsa) |

**Beklenen davranış:**

- Canlıda daha önce tarif yoksa açılışta "şifrelendi" satırı çıkmaz.
- Tarif yayınlanana kadar ana sayfadaki tarif bölümü ve menüdeki "Tarifler" bağlantısı **görünmez**; site eskisi gibi görünür.
- Mevcut planlar değişmeden açılır; PDF'ler eskisi gibi tek sayfadır (plana tarif eklenince ek sayfa çıkar).
- KVKK dışa aktarma dosyasında artık `nutritionPlans` ve `personalRecipes` bölümleri vardır.
- Fotoğraflar `storage/public/recipes/` altına yazılır; `storage/` kalıcı diskte olmalı (Docker'da `storage` birimi).
