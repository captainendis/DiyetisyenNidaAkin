# Mağaza başvurusu — App Store ve Google Play

Bu belge "Nida Akın" mobil uygulamasının (`mobile/`) mağaza kayıtları için gereken metinleri, form
yanıtlarını ve adımları içerir. Metinler Türkçedir; mağaza dili **Türkçe (tr-TR)** seçilmelidir.

> Yayın öncesi kontrol: gizlilik politikası ve KVKK metinleri hâlâ **taslak** olarak işaretli
> (`src/components/sections/legal/content.ts`). Mağazaya göndermeden önce hukuki inceleme tamamlanmalıdır.

---

## 1. Kimlik ve sürüm

| Alan | Değer |
| --- | --- |
| Uygulama adı | Nida Akın |
| Paket kimliği (iOS + Android) | `com.nidaakin.app` |
| Sürüm | `mobile/app.json → expo.version` (1.0.0); derleme numarası EAS'ta otomatik artar |
| Kategori | Sağlık ve Fitness (Health & Fitness) |
| Fiyat | Ücretsiz, uygulama içi satın alma yok, reklam yok |
| Destek URL'si | `https://nidaakin.com/iletisim` |
| Gizlilik politikası URL'si | `https://nidaakin.com/gizlilik-politikasi` |
| Hesap silme URL'si (Google Play) | `https://nidaakin.com/gizlilik-politikasi` → "Hesabın ve verilerin silinmesi" bölümü |

## 2. Mağaza metinleri

**Alt başlık (App Store, en fazla 30 karakter)**
```
Beslenme listen ve randevun
```

**Kısa açıklama (Google Play, en fazla 80 karakter)**
```
Beslenme listen, tariflerin, randevuların ve ilerlemen — diyetisyeninle tek yerde.
```

**Tanıtım metni (App Store, en fazla 170 karakter, sürüm beklemeden değiştirilebilir)**
```
Görüşmede verilen beslenme listen artık telefonunda: PDF aramadan öğünlerini aç, tariflerine bak, bir sonraki randevunu takip et.
```

**Açıklama (her iki mağaza, en fazla 4000 karakter)**
```
Nida Akın, Diyetisyen Nida Akın’ın danışanları ve ekibi için hazırlanmış resmî uygulamadır.

DANIŞANLAR İÇİN
• Beslenme listen: Görüşmede hazırlanan liste öğün öğün telefonunda. Her öğünde seçeneklerini gör, istersen PDF olarak paylaş.
• Tarifler: Listene eklenen ve sana özel uyarlanan tarifler; malzemeler, hazırlanışı ve ipuçlarıyla.
• Randevular: Yaklaşan ve geçmiş randevuların, talep durumun ve boş saatler. Yeni randevu talebini uygulamadan gönder.
• Pilates: Ders programın, grubun ve katılım geçmişin.
• İlerleme: Kilo ve mezura ölçümlerinin grafiği, vücut kompozisyonundaki değişim.
• Mesajlar ve dosyalar: Diyetisyeninin görüşme sonrası notları ve seninle paylaşılan belgeler.
• İnternetsiz: Son açtığın listeler ve tarifler bağlantı yokken de görünür.
• Bildirimler: Randevun onaylandığında, yeni listen ya da mesajın olduğunda haber verir.

DİYETİSYEN VE EKİBİ İÇİN
Web panelinin tamamı cepte: günlük gündem, randevu talepleri ve onayları, takvimde sürükle-bırak ile yeniden planlama, danışan dosyası (ölçümler, görüşme notları, dosyalar), beslenme planı düzenleyici ve A4 önizleme, tarif kütüphanesi, pilates grupları ve yoklama, web sitesi içeriği, blog, raporlar ve ayarlar.

GÜVENLİK
• Hesaplar diyetisyen tarafından açılır; uygulamada kayıt olunmaz.
• Klinik bilgiler sunucuda şifreli saklanır; oturum anahtarı cihazın güvenli deposunda tutulur.
• İsteğe bağlı Face ID / parmak izi kilidi.
• Reklam, analiz ya da izleme aracı yoktur.

Uygulama tıbbi tavsiye yerine geçmez; beslenme planın diyetisyeninle yaptığın görüşmeye dayanır.
```

**Anahtar kelimeler (App Store, en fazla 100 karakter, virgülle)**
```
diyetisyen,beslenme,diyet,liste,randevu,tarif,pilates,kilo,sağlıklı,beslenme planı,danışan
```

## 3. Ekran görüntüleri

Taslak ekran görüntüleri `docs/magaza/` klasöründedir (iOS 6.9" 1290×2796 ve Android 1080×1920).
Tarayıcı önizlemesinden demo verilerle üretilmiştir; mağazaya göndermeden önce **gerçek cihazdan**
(geliştirme derlemesi + demo verili sunucu) yeniden alınması önerilir. Gerçek danışan verisi içeren
ekran görüntüsü kullanmayın.

## 4. App Store Connect — Uygulama Gizliliği ("gizlilik etiketleri")

"Veri topluyor musunuz?" → **Evet**. Aşağıdakilerin tamamı **kullanıcıyla ilişkili**, amaç yalnızca
**Uygulama İşlevselliği**, **izleme (tracking) için kullanılmaz**:

| Veri türü | Ne | Not |
| --- | --- | --- |
| İletişim bilgisi → Ad, E-posta adresi, Telefon numarası | Danışan kaydı, giriş | |
| Sağlık ve Fitness → Sağlık | Ölçümler, beslenme listesi, görüşme notları (personel) | Sunucuda şifreli |
| Kullanıcı İçeriği → Diğer kullanıcı içeriği | Randevu talebindeki mesaj, yüklenen dosyalar | |
| Tanımlayıcılar → Cihaz kimliği | Bildirim adresi (push token) | Yalnızca bildirim izni verilirse |

"İzleme" sorusu → **Hayır**. App Tracking Transparency istemi gerekmez.

**Şifreleme (Export Compliance):** `app.json` içinde `ITSAppUsesNonExemptEncryption: false` (yalnızca
standart HTTPS kullanılır).

## 5. Google Play Console — Veri güvenliği formu

| Soru | Yanıt |
| --- | --- |
| Uygulama kullanıcı verisi topluyor ya da paylaşıyor mu? | Topluyor; **paylaşmıyor** (Expo bildirim altyapısı "hizmet sağlayıcı" sayılır, paylaşım değildir) |
| Aktarımda şifreleniyor mu? | Evet (HTTPS) |
| Kullanıcılar verilerinin silinmesini isteyebilir mi? | Evet — hesap silme URL'si (bkz. §1) ve uygulama içinden "Hesabımı silmek istiyorum" |
| Kişisel bilgiler | Ad, e-posta, telefon — Uygulama işlevselliği, Hesap yönetimi — Zorunlu |
| Sağlık ve fitness | Sağlık bilgileri — Uygulama işlevselliği — Zorunlu (danışan) |
| Mesajlar | Diğer uygulama içi mesajlar — Uygulama işlevselliği |
| Dosyalar ve belgeler | Uygulama işlevselliği — İsteğe bağlı |
| Cihaz veya diğer kimlikler | Bildirim adresi — Uygulama işlevselliği — İsteğe bağlı |

**Sağlık uygulamaları beyanı (Play):** "Sağlık ve fitness" → kişisel beslenme takibi / diyetisyen-danışan
iletişimi. Tıbbi cihaz değildir; teşhis koymaz.

**İçerik derecelendirmesi anketi:** şiddet/cinsellik/kumar yok, kullanıcılar arası serbest iletişim yok
(yalnızca diyetisyen → danışan mesajı) → beklenen sonuç: **3+ / PEGI 3**.

**Hedef kitle:** 18 yaş ve üzeri (sağlık hizmeti danışanları). "Çocuklara yönelik değil."

## 6. İnceleme ekibi için giriş bilgileri (zorunlu)

Apple ve Google, girişli uygulamalar için **çalışan demo hesap** ister. Gerçek danışan verisi
göstermeyin:

1. Ayrı bir demo kurulum açın (`DEMO_MODE=true npm run db:seed:demo`) **ya da** üretimde yalnızca demo
   verisi görecek bir danışan hesabı oluşturun.
2. İki hesap hazırlayın:
   - Danışan: Panel → Danışanlar → (demo danışan) → Hesap → hesap aç → bağlantıyla şifre belirle.
   - Personel: `ADMIN_ROLE=ASSISTANT npm run admin:create` (klinik veri görmeyen asistan rolü önerilir).
3. İnceleme notuna yazın:
   ```
   Uygulamada iki giriş vardır. Danışan girişi: <e-posta> / <şifre>. Panel girişi (asistan rolü): <e-posta> / <şifre>.
   Hesaplar diyetisyen tarafından açılır; uygulamada kayıt olunmaz. Bildirim izni isteğe bağlıdır.
   ```

## 7. Derleme ve gönderme

Derleme ve mağazalara yükleme GitHub Actions'ta yapılır (`.github/workflows/mobile.yml`): Android AAB → Google
Play (dahili test), iOS IPA → TestFlight. Gerekli sırlar ve ilk kurulum adımları: [MOBIL-DERLEME.md](MOBIL-DERLEME.md).

Android'de ilk yükleme sonrası **Play Console → Uygulama bütünlüğü → Uygulama imzalama** sayfasındaki
SHA-256 parmak izini sunucu ortam değişkenine (`ANDROID_CERT_SHA256`) yazın; e-postadaki bağlantılar
uygulamada açılsın. iOS için Apple Developer → Membership sayfasındaki **Team ID**'yi `APPLE_TEAM_ID`'ye yazın.
