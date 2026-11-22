// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Yasal metinler (KVKK aydınlatma, açık rıza, gizlilik, çerez).
 * Metinler sistemin gerçek işleyişine göre yazılmıştır; veri işleme faaliyeti değiştiğinde (yeni bir hizmet sağlayıcı,
 * yeni bir veri türü, farklı saklama süresi) güncellenmeli ve shared/constants.ts → KVKK_NOTICE_VERSION artırılmalıdır.
 * Köşeli parantez içindeki alanlar panelden işletme/iletişim bilgileri girildikçe otomatik dolar.
 */
import type { PublicSettings } from '@/data/types';
import { formatAddress } from '../address';
import { DEVELOPER } from '@shared/credits';

/** Barındırma sağlayıcısı (müşteri onayı, 2026-11-01) */
const HOSTING = { name: 'Hosting Dünyam', country: 'Türkiye' } as const;
/** Pasif / arşivlenmiş danışan kayıtlarının anonimleştirilme süresi (panel → Ayarlar → KVKK varsayılanı) */
const RETENTION_MONTHS = 36;

export type LegalDoc = 'kvkk' | 'consent' | 'privacy' | 'cookies';
export interface LegalSection { heading: string; paragraphs?: string[]; list?: string[] }
export interface LegalContent { title: string; accent?: string; description: string; intro: string; sections: LegalSection[] }

export function buildLegal(doc: LegalDoc, s: PublicSettings): LegalContent {
  const controller = s.business.legalName ?? '[Veri sorumlusunun resmî unvanı / adı soyadı]';
  const address = formatAddress(s.contact) ?? '[Açık adres]';
  const email = s.business.kvkkContactEmail ?? s.contact.email ?? '[KVKK başvuru e-posta adresi]';
  const processor = `${DEVELOPER.name} (${DEVELOPER.url.replace('https://', '')})`;
  // Başvuru adresi veri işleyene aitse, başvurunun kime ulaştığı açıkça yazılır.
  const emailIsProcessor = email.toLowerCase() === DEVELOPER.contact;
  const emailNote = emailIsProcessor ? ` Bu adrese gelen başvurular, veri sorumlusu adına ${DEVELOPER.name} tarafından alınır ve gecikmeksizin veri sorumlusuna iletilir.` : '';

  const rights: string[] = [
    'Kişisel verilerinizin işlenip işlenmediğini öğrenme,',
    'Kişisel verileriniz işlenmişse buna ilişkin bilgi talep etme,',
    'Kişisel verilerinizin işlenme amacını ve bunların amacına uygun kullanılıp kullanılmadığını öğrenme,',
    'Yurt içinde veya yurt dışında kişisel verilerinizin aktarıldığı üçüncü kişileri bilme,',
    'Kişisel verilerinizin eksik veya yanlış işlenmiş olması hâlinde bunların düzeltilmesini isteme,',
    'KVKK md. 7’de öngörülen şartlar çerçevesinde kişisel verilerinizin silinmesini veya yok edilmesini isteme,',
    'Düzeltme, silme veya yok etme işlemlerinin, kişisel verilerin aktarıldığı üçüncü kişilere bildirilmesini isteme,',
    'İşlenen verilerin münhasıran otomatik sistemler vasıtasıyla analiz edilmesi suretiyle aleyhinize bir sonucun ortaya çıkmasına itiraz etme,',
    'Kişisel verilerin kanuna aykırı olarak işlenmesi sebebiyle zarara uğramanız hâlinde zararın giderilmesini talep etme.',
  ];

  const application =
    `Haklarınızla ilgili taleplerinizi, Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ’e uygun olarak; ` +
    `adınız, soyadınız, T.C. kimlik numaranız (yabancılar için uyruk ve pasaport/kimlik numarası), tebligata esas adresiniz, varsa e-posta adresiniz ve talebinizin konusunu içeren ` +
    `ıslak imzalı bir dilekçeyle ${address} adresine elden ya da posta yoluyla, güvenli elektronik imza veya kayıtlı elektronik posta (KEP) ile ` +
    `ya da sistemimizde kayıtlı e-posta adresinizden ${email} adresine iletebilirsiniz.${emailNote}`;

  switch (doc) {
    case 'kvkk':
      return {
        title: 'KVKK Aydınlatma',
        accent: 'Metni',
        description: 'Web sitesi, randevu, beslenme danışmanlığı ve mobil uygulama süreçlerinde işlenen kişisel verilere ilişkin 6698 sayılı KVKK kapsamında aydınlatma metni.',
        intro:
          'Bu metin, 6698 sayılı Kişisel Verilerin Korunması Kanunu (“KVKK”) md. 10 ve Aydınlatma Yükümlülüğünün Yerine Getirilmesinde Uyulacak Usul ve Esaslar Hakkında Tebliğ uyarınca; web sitesini, randevu formunu, danışan hesabını ve “Nida Akın” mobil uygulamasını kullandığınızda ve beslenme danışmanlığı aldığınızda kişisel verilerinizin nasıl işlendiğini açıklar.',
        sections: [
          {
            heading: '1. Veri sorumlusu ve veri işleyen',
            paragraphs: [
              `Veri sorumlusu: ${controller}`,
              `Adres: ${address}`,
              `İletişim: ${email}`,
              `Veri işleyen: ${processor}. ${DEVELOPER.name}, ${DEVELOPER.processorRole} hizmetini veri sorumlusunun talimatları doğrultusunda ve yalnızca bu amaçla yürütür; kişisel verileri kendi amaçları için işlemez.`,
            ],
          },
          {
            heading: '2. Hangi kişisel verileri işliyoruz?',
            list: [
              'Kimlik: ad, soyad; danışanlar için doğum tarihi ve cinsiyet.',
              'İletişim: telefon numarası, e-posta adresi.',
              'Randevu ve hizmet: seçilen hizmet, görüşme türü (yüz yüze / online), tarih ve saat, randevu geçmişi, pilates ders programı ve katılım kayıtları, randevu formundaki mesaj alanına yazdıklarınız.',
              'Sağlık verileri (özel nitelikli kişisel veri, yalnızca danışmanlık hizmeti alan danışanlar için): kilo, mezura ve vücut kompozisyonu ölçümleri, beslenme alışkanlıkları ve tercihleri, beslenme planları, görüşme notları, sizin paylaştığınız tahlil sonucu gibi belgeler.',
              'Yazışmalar: diyetisyeninizin uygulama ve danışan hesabı üzerinden size gönderdiği mesajlar.',
              'Hesap ve işlem güvenliği: danışan hesabı e-posta adresi, şifrenin geri döndürülemez özeti (şifrenin kendisi saklanmaz), oturum kayıtları, IP adresi, işlem zamanları, onay kayıtları, sistem erişim (denetim) kayıtları.',
              'Cihaz bilgisi (yalnızca mobil uygulamada bildirimleri açarsanız): cihazınızın bildirim adresi (push token) ve cihaz türü.',
            ],
            paragraphs: [
              'Web sitesindeki randevu formunda sağlık bilgisi istenmez. Sağlık verileriniz yalnızca danışmanlık hizmeti başladıktan sonra ve açık rızanız alınarak işlenir (bkz. Açık Rıza Metni).',
            ],
          },
          {
            heading: '3. Hangi amaçlarla işliyoruz?',
            list: [
              'Randevu talebinizi almak, değerlendirmek ve sizinle iletişime geçmek,',
              'Randevularınızı ve pilates derslerinizi planlamak, onaylamak, değiştirmek veya iptal etmek,',
              'Size özel beslenme danışmanlığı vermek, beslenme planınızı hazırlamak ve ilerlemenizi takip etmek,',
              'Danışan hesabınızı ve mobil uygulamayı çalıştırmak; listelerinizi, tariflerinizi, randevularınızı ve mesajlarınızı size göstermek,',
              'Randevu, yeni liste ve mesaj gibi konularda size bildirim göndermek,',
              'Bilgi güvenliğini sağlamak, yetkisiz erişimi ve kötüye kullanımı önlemek,',
              'Mevzuattan doğan yükümlülükleri yerine getirmek ve yetkili kurumların taleplerini karşılamak,',
              'Hukuki bir uyuşmazlıkta hakkımızı kullanmak ve korumak.',
            ],
          },
          {
            heading: '4. Hukuki sebepler',
            list: [
              'Kimlik, iletişim, randevu ve hizmet verileriniz: danışmanlık hizmeti sözleşmesinin kurulması ve ifası (KVKK md. 5/2-c).',
              'İşlem güvenliği ve denetim kayıtları: veri sorumlusunun hukuki yükümlülüğü (md. 5/2-ç; özellikle md. 12’deki veri güvenliği yükümlülüğü) ve temel hak ve özgürlüklerinize zarar vermemek kaydıyla meşru menfaat (md. 5/2-f).',
              'Uyuşmazlık hâlinde kayıtların kullanılması: bir hakkın tesisi, kullanılması veya korunması (md. 5/2-e).',
              'Sağlık verileriniz ve randevu formunun mesaj alanında kendi isteğinizle paylaştığınız bilgiler: açık rızanız (md. 6/3-a).',
              'Bildirimler için yurt dışına aktarım: açık rızanız (md. 9/6-a; bkz. 5. bölüm).',
            ],
          },
          {
            heading: '5. Kişisel verileriniz kimlere aktarılır?',
            paragraphs: [
              `Yurt içi: Verileriniz, yalnızca yukarıdaki amaçlar için gerekli olduğu ölçüde ve KVKK md. 8’e uygun olarak; sistemin teknik hizmetlerini yürüten ${DEVELOPER.name}’e (veri işleyen), barındırma hizmeti alınan ${HOSTING.name}’a (sunucular ${HOSTING.country}’dedir), e-posta gönderimi için kullanılan e-posta hizmet sağlayıcısına ve kanunen yetkili kamu kurum ve kuruluşları ile yargı mercilerine aktarılabilir.`,
              'Yurt dışı: Mobil uygulamada bildirimleri açarsanız, bildirimin telefonunuza ulaşabilmesi için cihazınızın bildirim adresi ve bildirim metni Expo, Inc. (ABD) altyapısı üzerinden Google (Android) veya Apple (iOS) bildirim servislerine iletilir. Bildirim metinlerinde sağlık bilginiz yer almaz (ör. “Yeni beslenme listen hazır”). Bu aktarım KVKK md. 9 uyarınca açık rızanıza dayanır; bildirimleri kapatırsanız aktarım durur.',
              'Web sitesinin iletişim bölümündeki harita Google tarafından sağlanır; sayfa açıldığında IP adresiniz ve tarayıcı bilgileriniz Google’a iletilebilir (bkz. Çerez Politikası).',
              'Verileriniz reklam, pazarlama veya satış amacıyla hiçbir üçüncü kişiyle paylaşılmaz.',
            ],
          },
          {
            heading: '6. Toplama yöntemi',
            paragraphs: [
              'Kişisel verileriniz; web sitesindeki randevu formu, danışan hesabı, mobil uygulama, telefon, e-posta ve yüz yüze görüşmeler aracılığıyla, kısmen otomatik (form ve uygulama üzerinden) ve otomatik olmayan (görüşmede diyetisyen tarafından kayda geçirilerek) yollarla toplanır.',
            ],
          },
          {
            heading: '7. Ne kadar süre saklıyoruz?',
            list: [
              `Danışan kayıtları: danışmanlık ilişkisi sürdüğü müddetçe saklanır. Danışan kaydı pasif veya arşivlenmiş duruma geçtikten ve son işlemden itibaren ${RETENTION_MONTHS} ay geçtikten sonra görüşme notları, ölçümler ve dosyalar kalıcı olarak silinir; randevu kayıtları kimlik ve iletişim bilgisi çıkarılarak yalnızca istatistik amacıyla tutulur.`,
              'Danışmanlığa dönüşmeyen randevu talepleri: talebin sonuçlanmasından itibaren en fazla 1 yıl.',
              'Sistem erişim (denetim) kayıtları: en fazla 2 yıl.',
              'Süresi dolan oturum ve şifre sıfırlama kayıtları: süreleri dolduğunda silinir.',
              'Mobil uygulamada internetsiz kullanım için cihazınızda tutulan kopya: en fazla 7 gün; oturumu kapattığınızda hemen silinir.',
              'Bir mevzuat hükmü daha uzun bir saklama süresi öngörüyorsa veya bir uyuşmazlık söz konusuysa, ilgili kayıtlar bu süre boyunca saklanır.',
            ],
            paragraphs: [
              'Süre sonunda verileriniz Kişisel Verilerin Silinmesi, Yok Edilmesi veya Anonim Hale Getirilmesi Hakkında Yönetmelik’e uygun olarak silinir, yok edilir veya anonim hâle getirilir.',
            ],
          },
          { heading: '8. Haklarınız (KVKK md. 11)', list: rights },
          {
            heading: '9. Başvuru',
            paragraphs: [
              application,
              'Başvurunuz, niteliğine göre en kısa sürede ve en geç otuz gün içinde ücretsiz olarak sonuçlandırılır. İşlemin ayrıca bir maliyet gerektirmesi hâlinde Kişisel Verileri Koruma Kurulu’nca belirlenen tarifedeki ücret alınabilir.',
              'Başvurunuzun reddedilmesi, verilen cevabı yetersiz bulmanız veya süresinde cevap verilmemesi hâlinde, KVKK md. 14 uyarınca Kişisel Verileri Koruma Kurulu’na şikâyette bulunabilirsiniz.',
            ],
          },
          {
            heading: '10. Veri güvenliği',
            paragraphs: [
              'KVKK md. 12 uyarınca verilerinizi korumak için gerekli teknik ve idari tedbirler alınır: site ve uygulama ile sunucu arasındaki tüm iletişim şifrelidir (HTTPS); görüşme notları, ölçümler, mesajlar ve dosyalar sunucuda şifrelenmiş olarak saklanır; şifreler geri döndürülemez biçimde saklanır; panele yalnızca yetkili kişiler erişir, her erişim kayıt altına alınır ve yetkiler görev gereğiyle sınırlıdır.',
              'Kişisel verilerin hukuka aykırı olarak kaydedilmesi, başkasına verilmesi, yayılması, ele geçirilmesi veya süresi dolduğu hâlde yok edilmemesi 5237 sayılı Türk Ceza Kanunu md. 135–138 uyarınca; bilişim sistemine izinsiz girilmesi ve sistemdeki verilerin bozulması, yok edilmesi veya değiştirilmesi md. 243–244 uyarınca suçtur. Verilerinize erişen herkes bu yükümlülüklerle bağlıdır. Verilerinizin hukuka aykırı olarak başkalarınca elde edildiğini öğrenirsek bu durumu en kısa sürede size ve Kişisel Verileri Koruma Kurulu’na bildiririz (KVKK md. 12/5).',
            ],
          },
        ],
      };
    case 'consent':
      return {
        title: 'Açık Rıza',
        accent: 'Metni',
        description: 'Randevu formu, sağlık verileri ve mobil uygulama bildirimlerine ilişkin açık rıza metni.',
        intro:
          'KVKK’ya göre bazı kişisel verilerin işlenmesi için açık rızanız gerekir. Açık rıza; belirli bir konuya ilişkin, bilgilendirilmeye dayanan ve özgür iradeyle verilen onaydır. Aşağıdaki rızaların her biri ayrı ayrı istenir; birini vermeniz diğerlerini vermeniz anlamına gelmez. Rıza vermemeniz randevu talebinde bulunmanıza engel değildir.',
        sections: [
          {
            heading: '1. Randevu formundaki mesaj alanı',
            paragraphs: [
              `KVKK Aydınlatma Metni’ni okudum. Randevu formunun mesaj alanına kendi isteğimle yazdığım bilgilerin, randevu talebimin değerlendirilmesi ve görüşmenin planlanması amacıyla ${controller} tarafından işlenmesine açık rıza veriyorum.`,
              'Bu rıza, randevu formundaki onay kutusunu işaretlemenizle verilir. Mesaj alanını boş bırakabilirsiniz.',
            ],
          },
          {
            heading: '2. Sağlık verilerinin işlenmesi (danışanlar)',
            paragraphs: [
              `KVKK Aydınlatma Metni’ni okudum. Beslenme danışmanlığı hizmeti kapsamında kilo, mezura ve vücut kompozisyonu ölçümlerim, beslenme alışkanlıklarım, beslenme planlarım, görüşme notlarım ve paylaştığım belgeler gibi sağlık verilerimin; danışmanlık hizmetinin verilmesi, beslenme planımın hazırlanması ve ilerlememin takip edilmesi amacıyla ${controller} tarafından işlenmesine ve şifreli olarak saklanmasına açık rıza veriyorum.`,
              'Bu rıza danışmanlık başlamadan önce ayrıca alınır ve kayda geçirilir. Rıza vermezseniz sağlık verileriniz kaydedilmez; ancak kişiye özel beslenme planı hazırlanamayabilir.',
            ],
          },
          {
            heading: '3. Mobil uygulama bildirimleri için yurt dışına aktarım',
            paragraphs: [
              'Mobil uygulamada bildirimleri açmam hâlinde, bildirimlerin telefonuma ulaştırılabilmesi için cihazımın bildirim adresinin ve sağlık bilgisi içermeyen bildirim metinlerinin Expo, Inc. (ABD) ile Google veya Apple bildirim servisleri aracılığıyla yurt dışına aktarılmasına açık rıza veriyorum. Yurt dışındaki hizmet sağlayıcıların Türkiye’deki ile aynı düzeyde koruma sağlamayabileceği konusunda bilgilendirildim.',
              'Bildirimleri istediğiniz zaman telefonunuzun ayarlarından kapatabilirsiniz; bu durumda aktarım durur ve uygulama çalışmaya devam eder.',
            ],
          },
          {
            heading: 'Rızanızı geri almak',
            paragraphs: [
              `Açık rızalarınızı dilediğiniz zaman ${email} adresine bildirerek geri alabilirsiniz. Geri alma, o tarihten önce rızaya dayanarak yapılmış işlemleri etkilemez; rızaya dayanan veriler, başka bir hukuki sebep veya saklama yükümlülüğü yoksa silinir.`,
            ],
          },
        ],
      };
    case 'privacy':
      return {
        title: 'Gizlilik',
        accent: 'Politikası',
        description: 'Web sitesi, danışan hesabı ve “Nida Akın” mobil uygulamasında kişisel verilerinizin nasıl korunduğunu anlatan gizlilik politikası.',
        intro:
          'Bu politika; web sitesini ziyaret ettiğinizde, randevu talep ettiğinizde, danışan hesabınızı ve “Nida Akın” mobil uygulamasını kullandığınızda bilgilerinizin nasıl toplandığını, kullanıldığını ve korunduğunu sade bir dille özetler. Ayrıntılar için KVKK Aydınlatma Metni’ne bakabilirsiniz.',
        sections: [
          {
            heading: 'Kısaca',
            list: [
              'Yalnızca hizmet için gereken bilgileri isteriz.',
              'Sağlık verileriniz yalnızca açık rızanızla ve şifrelenerek saklanır.',
              'Reklam, analiz veya izleme aracı kullanmayız; verilerinizi satmayız ve pazarlama için kimseyle paylaşmayız.',
              'Verileriniz Türkiye’deki sunucularda tutulur.',
              'Verilerinizi istediğiniz zaman görebilir, düzeltilmesini veya silinmesini isteyebilirsiniz.',
            ],
          },
          {
            heading: 'Hangi bilgileri topluyoruz?',
            list: [
              'Randevu talep ederken: ad, soyad, telefon, e-posta, seçtiğiniz hizmet ve saat, isteğe bağlı mesajınız.',
              'Danışan olduğunuzda: doğum tarihi, cinsiyet, ölçümleriniz, beslenme planlarınız, görüşme notları, paylaşılan belgeler ve diyetisyeninizin mesajları.',
              'Hesabınızı kullanırken: giriş zamanları, IP adresi ve güvenlik kayıtları.',
              'Mobil uygulamada bildirimleri açarsanız: cihazınızın bildirim adresi.',
            ],
          },
          {
            heading: 'Bilgilerinizi nasıl kullanıyoruz?',
            paragraphs: [
              'Bilgileriniz yalnızca randevularınızı yönetmek, size özel beslenme danışmanlığı vermek, danışan hesabınızı ve uygulamayı çalıştırmak, size bildirim göndermek ve sistemin güvenliğini sağlamak için kullanılır.',
            ],
          },
          {
            heading: 'Güvenlik önlemleri',
            list: [
              'Tüm iletişim şifreli bağlantı (HTTPS) üzerinden yapılır.',
              'Görüşme notları, ölçümler, mesajlar ve dosyalar sunucuda şifrelenmiş olarak saklanır.',
              'Şifreniz geri döndürülemez biçimde saklanır; kimse şifrenizi göremez.',
              'Yönetim paneline yalnızca yetkili kişiler erişir; her erişim kayıt altına alınır.',
              'Hesaplar birden çok hatalı girişte geçici olarak kilitlenir.',
            ],
          },
          {
            heading: 'Mobil uygulama',
            paragraphs: [
              '“Nida Akın” mobil uygulaması (iOS ve Android), web sitesindeki danışan hesabının ve yönetim panelinin karşılığıdır; aynı sunucuyu ve aynı güvenlik kurallarını kullanır. Uygulamada kayıt olunmaz; danışan hesapları diyetisyen tarafından açılır.',
              'Oturum anahtarı cihazınızın güvenli deposunda (iOS Anahtar Zinciri / Android Keystore) saklanır. İsteğe bağlı Face ID / parmak izi kilidi tamamen cihazınızda çalışır; biyometrik veriniz uygulamaya ya da sunucuya iletilmez.',
              'Bildirimlere izin verirseniz cihazınızın bildirim adresi yalnızca size randevu, liste ve mesaj bildirimleri göndermek için saklanır. Bildirimler Expo, Inc. (ABD) altyapısı üzerinden Apple ve Google bildirim servislerine iletilir; bildirim metinlerinde sağlık bilginiz yer almaz. Oturumu kapattığınızda bu adres silinir.',
              'İnternetsiz kullanım için beslenme listeleriniz, tarifleriniz, randevularınız ve ölçümleriniz cihazınızda en fazla 7 gün saklanır; oturumu kapattığınızda silinir. Personel uygulamasında klinik veriler cihaza kaydedilmez.',
              'Kamera ve fotoğraf erişimi yalnızca siz bir dosya ya da görsel yüklemeyi seçtiğinizde istenir.',
            ],
          },
          {
            heading: 'Saklama süresi',
            paragraphs: [
              `Bilgileriniz danışmanlık ilişkisi sürdüğü müddetçe saklanır. Danışan kaydınız pasif duruma geçtikten ve son işleminizden itibaren ${RETENTION_MONTHS} ay geçtikten sonra sağlık verileriniz kalıcı olarak silinir, diğer kayıtlar anonim hâle getirilir. Ayrıntılı süreler KVKK Aydınlatma Metni’nde yer alır.`,
            ],
          },
          {
            heading: 'Hesabınızın ve verilerinizin silinmesi',
            paragraphs: [
              'Danışan hesabınızın kapatılmasını ve verilerinizin silinmesini mobil uygulamadan ya da web sitesindeki danışan hesabınızdan isteyebilirsiniz: Hesap → “Hesabımın ve verilerimin silinmesini iste”. Talebiniz tarih damgasıyla kaydedilir ve diyetisyeninize iletilir.',
              `Uygulamaya erişemiyorsanız, sistemde kayıtlı e-posta adresinizden ${email} adresine “Hesap ve veri silme talebi” konulu bir e-posta da gönderebilirsiniz. Talebinizde adınızı, soyadınızı ve hesabınıza kayıtlı e-posta adresinizi belirtin.`,
              'Talebiniz en geç 30 gün içinde sonuçlandırılır: hesabınız kapatılır, oturumlarınız sonlandırılır, sağlık verileriniz, mesajlarınız ve dosyalarınız kalıcı olarak silinir; diğer kayıtlarınız silinir veya anonim hâle getirilir. Bir mevzuat hükmü gereği saklanması zorunlu olan kayıtlar varsa, yalnızca bu süre boyunca ve erişimi kısıtlanarak saklanır ve süre sonunda silinir. Sonuç size e-postayla bildirilir.',
              'Hesabınızı kapatmadan yalnızca belirli verilerinizin silinmesini de aynı yolla isteyebilirsiniz.',
            ],
          },
          {
            heading: 'Çocukların gizliliği',
            paragraphs: [
              '18 yaşından küçük danışanların kaydı ve sağlık verilerinin işlenmesi için velinin veya yasal temsilcinin onayı alınır. Mobil uygulama 18 yaşından küçüklere yönelik değildir.',
            ],
          },
          {
            heading: 'Üçüncü taraf hizmetler',
            paragraphs: [
              'İletişim sayfasındaki harita Google tarafından sağlanır ve Google’ın gizlilik koşullarına tabidir. Bildirimler için kullanılan hizmet sağlayıcılar yukarıda belirtilmiştir. Bunların dışında hiçbir üçüncü taraf hizmeti verilerinize erişmez.',
            ],
          },
          {
            heading: 'Değişiklikler',
            paragraphs: [
              'Bu politika, veri işleme faaliyetlerimiz değiştiğinde güncellenir. Güncel sürüm her zaman bu sayfada yayımlanır; sürüm bilgisi sayfanın yanında yer alır.',
            ],
          },
          { heading: 'İletişim', paragraphs: [`Gizlilikle ilgili sorularınız ve talepleriniz için: ${email}`] },
        ],
      };
    case 'cookies':
      return {
        title: 'Çerez',
        accent: 'Politikası',
        description: 'Web sitesinde kullanılan çerezlere ilişkin bilgilendirme.',
        intro:
          'Çerezler, ziyaret ettiğiniz siteler tarafından tarayıcınıza kaydedilen küçük metin dosyalarıdır. Bu sitede reklam, analiz veya izleme amaçlı çerez kullanılmaz; yalnızca giriş yapan kullanıcıların oturumunu sürdürmek için zorunlu çerezler kullanılır.',
        sections: [
          {
            heading: 'Kullandığımız çerezler',
            list: [
              '“na_sid” — Zorunlu oturum çerezi (yalnızca yönetim paneli): Yetkili kullanıcıların güvenli oturumunu sürdürür. Oturum kapatılınca veya en geç 12 saatte (“Beni hatırla” seçilirse 30 günde) silinir.',
              '“na_csid” — Zorunlu oturum çerezi (yalnızca danışan hesabı): Danışan hesabına giriş yapan kullanıcının oturumunu sürdürür. Oturum kapatılınca veya en geç 12 saatte (“Beni hatırla” seçilirse 30 günde) silinir.',
            ],
            paragraphs: [
              'Bu çerezler yalnızca giriş yaptığınızda oluşturulur, tarayıcı betiklerince okunamaz, yalnızca şifreli bağlantı üzerinden gönderilir ve başka sitelerle paylaşılmaz. Sitenin çalışması için zorunlu oldukları için açık rızanız aranmaz (KVKK md. 5/2-c ve f). Siteyi yalnızca ziyaret eden kişiler için hiçbir çerez oluşturulmaz.',
            ],
          },
          {
            heading: 'Üçüncü taraf içerikler',
            paragraphs: [
              'İletişim bölümünde gösterilen harita Google Haritalar tarafından sağlanır. Harita yüklendiğinde Google, IP adresiniz gibi bilgileri alabilir ve kendi çerezlerini kullanabilir. Bu çerezler üzerinde kontrolümüz yoktur; Google’ın gizlilik politikasına tabidir. Haritayı görüntülemek istemiyorsanız tarayıcınızda üçüncü taraf çerezlerini engelleyebilirsiniz.',
            ],
          },
          {
            heading: 'Çerez tercihleriniz',
            paragraphs: [
              'Tarayıcınızın ayarlarından çerezleri görebilir, silebilir veya engelleyebilirsiniz. Zorunlu çerezleri engellerseniz panele ve danışan hesabına giriş yapamazsınız; sitenin geri kalanı çalışmaya devam eder.',
            ],
          },
          { heading: 'İletişim', paragraphs: [`Çerezlerle ilgili sorularınız için: ${email}`] },
        ],
      };
  }
}
