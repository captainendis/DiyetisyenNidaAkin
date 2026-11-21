# DESIGN.md — Nida Akın Diyetisyen

Tasarım yönü. Web sitesi, yönetim paneli ve mobil uygulama (`mobile/`) için geçerlidir.
Renk ve yazı tiplerinin kaynağı kodda: web `src/styles/index.css` (`@theme`), mobil `mobile/src/theme/index.ts`.
Bu dosya o sistemin neden böyle olduğunu ve neye sadık kalınacağını anlatır; yeni bir renk ya da yazı tipi buradan değil, önce o dosyalardan eklenir.

## Kimlik

Esenyurt Bahçekent'te, bir pilates stüdyosunun üst katında çalışan tek bir diyetisyen. Büyük bir klinik, bir uygulama girişimi ya da bir "wellness markası" değil.
Ton: sakin, sıcak, yetişkin. Yasaklarla değil dengeyle konuşan biri. Akşam ışığında bir danışmanlık odası.

- Ne olmalı: editoryal, sade, sıcak, güven veren, kişisel.
- Ne olmamalı: fitness uygulaması enerjisi, motivasyon posteri, klinik soğukluk, "AI destekli" teknoloji vitrini, emoji, abartılı vaat ("30 günde 10 kilo").

## Palet

Koyu sıcak kahveler ve krem; tek vurgu rengi gül kurusu. Yeşil "sağlıklı yaşam" klişesi kullanılmaz.

| Rol | Token | Değer | Kullanım |
| --- | --- | --- | --- |
| Birincil koyu zemin | `espresso` | #211710 | Hero, alt bilgi, panel yan menü, uygulama ikonu |
| İkincil koyu zemin | `cocoa` | #302219 | Koyu bölümler, birincil buton dolgusu (açık zeminde) |
| Koyu yüzey | `umber` | #3B2B20 | Koyu zemin üstü kartlar |
| Açık zemin | `cream` / `ivory` / `sand` | #F4EBDD / #FAF6EF / #EBDFCC | Sayfa zeminleri, kartlar |
| Vurgu | `rose` | #DDAFA0 | Yalnızca ana eylem ve kilit anlar; sayfa başına bir iki kez |
| İkincil vurgu | `gold` | #B99569 | İnce çizgiler, sıra numaraları, küçük etiketler |
| Koyuda ikincil metin | `mist` | #B9A99A | |

Kontrast kuralı (WCAG 2.1 AA): açık zeminde metin ve anlam taşıyan ikon için `gold`, `rose` ve durum renkleri kullanılmaz; `-ink` tonları kullanılır (`gold-ink`, `rose-ink`, `success-ink`…; hepsi ≥ 4,5:1). Ana renkler koyu zeminde metin, açık zeminde yalnızca dolgu, çizgi ve süs içindir.

Panel kendi sakin tonlarını kullanır (`panel-bg`, `panel-line`, `panel-muted`) ve durum renkleri (`success`, `warning`, `danger`, `info`) yalnızca durum bildirmek içindir.

## Tipografi

- Başlıklar: **Cormorant Garamond** (değişken). Büyük, ince, sıkı satır aralığı; editoryal dergi hissi. Rakamlar da bu yazı tipinde (öğün saatleri "06.30" gibi).
- Gövde ve arayüz: **Manrope** (değişken).
- Küçük etiketler: Manrope, büyük harf, geniş harf aralığı, `gold-ink`. Kısa tutulur ("GÜNCEL LİSTEN", "SIRADAKİ GÖRÜŞME").
- Başka yazı tipi eklenmez.

## Düzen

- Web sitesi: geniş boşluk, asimetrik ızgara (12 sütun; metin 7 sütun, yan not 3 sütun gibi), uzun okuma satırı yerine dar sütun.
- Bölümler birbirinin kopyası olmaz: her bölüm kendi içeriğine göre kurulur (hikâye, süreç adımları, tarif kartları, harita farklı biçimlerde).
- Panel: yoğun ama sakin; tablo ve formlar okunaklı, eylemler sağ üstte, yıkıcı eylemler ayrık ve onaylı.
- Mobil: tek sütun, alt sekme çubuğu, büyük dokunma alanları (en az 44 px), kartlar beyaz zemin üstünde ince çizgili.

## Görseller

Gerçek mekân fotoğrafları (panelden yüklenir; yedekleri `public/images/`). Stok "sağlıklı tabak" fotoğrafı, yapay zekâ görseli, soyut gradyan blob kullanılmaz. İkonlar ince çizgili, tek renk.

## Hareket

Az ve yumuşak: sayfa girişinde soluk belirme, `--ease-soft`. Sayaç animasyonu, parallaks, sürekli dönen öğe yok. `prefers-reduced-motion` her zaman uygulanır.

Dial: ENERGY 2 / RHYTHM 3 / MOTION 1

## Dil ve ses

- Türkçe. Web sitesinde ziyaretçiye **siz**; danışan hesabında ve uygulamada danışana **sen** (sıcak, birebir ilişki). Panelde personele nötr, kısa ifadeler.
- Kısa cümle, somut bilgi. Sayı uydurulmaz ("%98 memnuniyet", "1000+ danışan" gibi doğrulanmamış iddialar yok).
- Tıbbi vaat yok; teşhis ve tedavi dili kullanılmaz. Uygulama tıbbi tavsiye yerine geçmez.
- Hata ve boş durum metinleri ne olduğunu ve ne yapılacağını söyler ("Henüz sana verilmiş bir beslenme listesi yok. Görüşmeden sonra listen burada görünecek.").

## Güvenlik ve gizlilik görünürlüğü

Sağlık verisi işlenen her ekranda bunun şifreli saklandığı ve kimin gördüğü sade bir notla söylenir; korkutucu kilit simgeleri ya da "askerî düzey şifreleme" gibi abartılar kullanılmaz.
