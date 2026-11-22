# Mağaza başvurusu — App Store ve Google Play

Bu belge "Nida Akın" mobil uygulamasının (`mobile/`) mağaza kayıtları için gereken metinleri, form
yanıtlarını ve adımları içerir. Metinler Türkçedir; mağaza dili **Türkçe (tr-TR)** seçilmelidir.

> Yasal metinler (KVKK aydınlatma, açık rıza, gizlilik, çerez) sistemin gerçek işleyişine göre yazılmıştır
> (`src/components/sections/legal/content.ts`); yayın öncesinde bir hukuk uzmanına inceletilmesi önerilir.

---

## 1. Kimlik ve sürüm

| Alan | Değer |
| --- | --- |
| Mağaza adı (Google Play + App Store, en fazla 30 karakter) | Diyetisyen Nida Akın: Beslenme |
| Ana ekrandaki ad (`mobile/app.json → expo.name`) | Nida Akın |
| Paket kimliği (iOS + Android) | `com.nidaakin.app` |
| Sürüm | `mobile/app.json → expo.version` (1.0.0); derleme numarası EAS'ta otomatik artar |
| Kategori | Sağlık ve Fitness (Health & Fitness) |
| Fiyat | Ücretsiz, uygulama içi satın alma yok, reklam yok |
| Destek URL'si | `https://nidaakin.com/iletisim` |
| Gizlilik politikası URL'si | `https://nidaakin.com/gizlilik-politikasi` |
| Hesap silme URL'si (Google Play) | `https://nidaakin.com/gizlilik-politikasi` → "Hesabınızın ve verilerinizin silinmesi" bölümü |
| Uygulama içi hesap silme (App Store 5.1.1(v)) | Danışan: Hesap → "Hesabımın ve verilerimin silinmesini iste" (talep tarihlenir, diyetisyene bildirilir, en geç 30 gün) |
| Geliştirici hesabı | PaperAxis (Google Play: kişisel hesap; App Store: PaperAxis). Uygulamanın sahibi: Nida Akın |

## 2. Mağaza metinleri

**Alt başlık (App Store, en fazla 30 karakter)** — adda geçmeyen arama kelimeleri
```
Diyet listesi ve kilo takibi
```

**Kısa açıklama (Google Play, en fazla 80 karakter)**
```
Diyet listen, tariflerin ve randevuların diyetisyeninle tek yerde. Kolay takip.
```

**Tanıtım metni (App Store, en fazla 170 karakter, sürüm beklemeden değiştirilebilir)**
```
Görüşmede verilen beslenme listen artık telefonunda: PDF aramadan öğünlerini aç, tariflerine bak, bir sonraki randevunu takip et.
```

**Açıklama (her iki mağaza, en fazla 4000 karakter)**
```
Diyetisyen Nida Akın’ın danışanları için resmî beslenme ve diyet takip uygulaması: kişiye özel beslenme listen, sağlıklı tarifler, diyetisyen randevusu ve kilo takibi tek yerde.

DANIŞANLAR İÇİN
• Beslenme listesi: Görüşmede hazırlanan diyet listen öğün öğün telefonunda. Her öğünde seçeneklerini gör, istersen PDF olarak paylaş.
• Sağlıklı tarifler: Listene eklenen ve sana özel uyarlanan tarifler; malzemeler, hazırlanışı ve ipuçlarıyla.
• Diyetisyen randevusu: Yaklaşan ve geçmiş randevuların, talep durumun ve boş saatler. Yeni randevu talebini uygulamadan gönder.
• Pilates: Ders programın, grubun ve katılım geçmişin.
• Kilo ve ölçü takibi: Kilo ve mezura ölçümlerinin grafiği, vücut kompozisyonundaki değişim.
• Mesajlar ve dosyalar: Diyetisyeninin görüşme sonrası notları ve seninle paylaşılan belgeler.
• İnternetsiz: Son açtığın listeler ve tarifler bağlantı yokken de görünür.
• Bildirimler: Randevun onaylandığında, yeni listen ya da mesajın olduğunda haber verir.

DİYETİSYEN VE EKİBİ İÇİN
Web panelinin tamamı cepte: günlük gündem, randevu talepleri ve onayları, takvimde sürükle-bırak ile yeniden planlama, danışan takibi (ölçümler, notlar, paylaşılan dosyalar), beslenme planı düzenleyici ve A4 önizleme, tarif kütüphanesi, pilates grupları ve yoklama, web sitesi içeriği, blog, raporlar ve ayarlar.

GÜVENLİK
• Hesaplar diyetisyen tarafından açılır; uygulamada kayıt olunmaz.
• Ölçümler, notlar ve mesajlar sunucuda şifreli saklanır; oturum anahtarı cihazın güvenli deposunda tutulur.
• İsteğe bağlı Face ID / parmak izi kilidi.
• Reklam, analiz ya da izleme aracı yoktur.

Uygulama bir beslenme ve kilo takip aracıdır; teşhis veya tedavi amacı taşımaz ve tıbbi tavsiye yerine geçmez. Beslenme planın diyetisyeninle yaptığın görüşmeye dayanır.
```

**Anahtar kelimeler (App Store, en fazla 100 karakter, virgülle, boşluksuz)** — App Store ad ve alt başlıktaki
kelimeleri zaten arar; burada tekrarlanmaz (diyetisyen, nida, akın, beslenme, diyet, listesi, kilo, takibi):
```
randevu,tarif,sağlıklı,öğün,porsiyon,kalori,ölçü,pilates,zayıflama,program,plan,danışan,esenyurt
```

## 3. Ekran görüntüleri

Taslak ekran görüntüleri `docs/magaza/` klasöründedir (iOS 6.9" 1290×2796 ve Android 1080×1920).
İlk iOS sürümü yalnızca iPhone içindir (`ios.supportsTablet: false`); bu yüzden App Store iPad ekran görüntüsü istemez.
iPad desteği açılırsa 13" iPad (2064×2752) ekran görüntüleri eklenmelidir. iOS simgesi alpha kanalı olmadan
`mobile/assets/images/icon-ios.png` dosyasındadır (App Store saydamlık kanalı olan simgeyi reddeder).
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

**Yaş derecelendirmesi (App Store):** tüm sorulara "Yok" (şiddet, cinsellik, kumar, kontrolsüz web erişimi yok;
"Tıbbi/Tedavi Bilgisi" → Yok: beslenme listesi ve kilo takibi tıbbi tedavi bilgisi değildir) → **4+**. Kategori:
**Sağlık ve Fitness**, ikincil kategori: **Yaşam Tarzı**.

**Geliştirici notu (App Store yönergesi 5.1.1(ix)):** Apple, sağlık gibi düzenlenmiş alanlarda hizmet veren ve hassas
veri işleyen uygulamaların bireysel geliştiriciyle değil, kurumsal (organization) hesapla yayımlanmasını bekler.
Uygulama PaperAxis hesabından gönderilir; inceleme notunda uygulamanın bir diyetisyenin danışanları için beslenme
takip aracı olduğu, teşhis/tedavi yapmadığı ve PaperAxis'in hizmeti geliştirici/veri işleyen olarak yürüttüğü
belirtilmelidir. Ret gelirse Nida Akın adına kurumsal hesap (D-U-N-S) gerekir.

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

**Sağlık uygulamaları beyanı (Play):** yalnızca "Beslenme ve kilo yönetimi" (Sağlık ve Fitness). Tıbbi değildir;
teşhis veya tedavi koymaz. "Sağlık hizmetleri ve yönetimi" gibi **tıbbi** bir özellik işaretlenirse Google, uygulamanın
kurumsal (organization) geliştirici hesabından yayımlanmasını şart koşar; kişisel hesapta ret gelir (2026-11-21).

**İçerik derecelendirmesi anketi:** şiddet/cinsellik/kumar yok, kullanıcılar arası serbest iletişim yok
(yalnızca diyetisyen → danışan mesajı) → beklenen sonuç: **3+ / PEGI 3**.

**Hedef kitle:** 18 yaş ve üzeri (sağlık hizmeti danışanları). "Çocuklara yönelik değil."

## 6. İnceleme ekibi için giriş bilgileri (zorunlu)

Apple ve Google, girişli uygulamalar için **çalışan demo hesap** ister. Gerçek danışan verisi
göstermeyin:

1. Ayrı bir demo kurulum açın (`DEMO_MODE=true npm run db:seed:demo`) **ya da** üretimde yalnızca demo
   verisi görecek bir danışan hesabı oluşturun.
2. Hazır hesaplar (şifreler depoda değil; `~/.nidaakin-mobil/demo-hesap.txt`):
   - Danışan: `demo@nidaakin.com` — panelde **isDemo** işaretli "Demo Danışan"; örnek liste, ölçüm ve mesaj içerir.
   - Personel: `inceleme@nidaakin.com` — **REVIEWER** rolü (`server/auth/reviewer.ts`): salt okunur, yalnızca demo
     danışanları görür, bildirim almaz. Raporlar, denetim kaydı, kullanıcılar ve pilates grupları kapalıdır.
3. İnceleme notu (İngilizce; App Store Connect → App Review Information → Notes):
   ```
   There is no in-app sign-up: accounts are created by the dietitian. Two logins are provided.
   Client login: on the welcome screen tap "Danışan girişi" — demo@nidaakin.com / <password>.
   Staff login: tap "Nida Akın & ekip" — inceleme@nidaakin.com / <password>. This review account is read-only and
   shows demo data only, because the staff panel handles real clients' health data.
   Account deletion: Hesap (Account) → "Hesabımın ve verilerimin silinmesini iste". The request is recorded and the
   dietitian completes it within 30 days, as required for records kept by a health professional.
   Notifications are optional and asked for only after a consent screen. Face ID lock is optional.
   The app is a nutrition and weight tracking tool for a dietitian's clients; it does not diagnose or treat.
   ```

## 7. Derleme ve gönderme

Derleme ve mağazalara yükleme GitHub Actions'ta yapılır (`.github/workflows/mobile.yml`): Android AAB → Google
Play (dahili test), iOS IPA → TestFlight. Gerekli sırlar ve ilk kurulum adımları: [MOBIL-DERLEME.md](MOBIL-DERLEME.md).

Android'de ilk yükleme sonrası **Play Console → Uygulama bütünlüğü → Uygulama imzalama** sayfasındaki
SHA-256 parmak izini sunucu ortam değişkenine (`ANDROID_CERT_SHA256`) yazın; e-postadaki bağlantılar
uygulamada açılsın. iOS için Apple Developer → Membership sayfasındaki **Team ID**'yi `APPLE_TEAM_ID`'ye yazın.
