// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Yasal metin TASLAKLARI. Bu metinler hukuki görüş değildir; yayın öncesinde bir hukuk uzmanınca
 * gözden geçirilmeli ve işletmenin gerçek veri işleme faaliyetlerine göre güncellenmelidir.
 * Köşeli parantez içindeki alanlar doğrulanmış bilgilerle doldurulmalıdır (panelden işletme/iletişim bilgileri girildikçe otomatik dolar).
 */
import type { PublicSettings } from '@/data/types';
import { formatAddress } from '../address';
import { DEVELOPER } from '@shared/credits';

/** Barındırma sağlayıcısı (müşteri onayı, 2026-11-01) */
const HOSTING = { name: 'Hosting Dünyam', country: 'Türkiye' } as const;

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

  switch (doc) {
    case 'kvkk':
      return {
        title: 'KVKK Aydınlatma',
        accent: 'Metni',
        description: '6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında web sitesi ve randevu süreçlerine ilişkin aydınlatma metni (taslak).',
        intro:
          'Bu aydınlatma metni, 6698 sayılı Kişisel Verilerin Korunması Kanunu’nun (“KVKK”) 10. maddesi ile Aydınlatma Yükümlülüğünün Yerine Getirilmesinde Uyulacak Usul ve Esaslar Hakkında Tebliğ kapsamında, web sitesi ve randevu talep süreçlerinde işlenen kişisel verileriniz hakkında sizi bilgilendirmek amacıyla hazırlanmıştır.',
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
            heading: '2. İşlenen kişisel veriler',
            list: [
              'Kimlik bilgileri: ad, soyad',
              'İletişim bilgileri: telefon numarası, e-posta adresi',
              'Randevu bilgileri: tercih edilen hizmet, görüşme türü (yüz yüze / online), talep edilen tarih ve saat',
              'Talep içeriği: randevu formundaki mesaj alanına sizin tarafınızdan yazılan bilgiler',
              'İşlem güvenliği bilgileri: IP adresi, form gönderim zamanı ve onay kayıtları',
            ],
            paragraphs: [
              'Randevu formunda sağlık durumunuza ilişkin bilgi talep edilmez. Görüşme sürecinde sağlık verisi işlenmesi gerekmesi hâlinde, bu veriler KVKK md. 6 kapsamında ayrıca bilgilendirme yapılarak ve gerekli hukuki şartlar sağlanarak işlenir.',
            ],
          },
          {
            heading: '3. İşleme amaçları',
            list: [
              'Randevu talebinizin alınması, değerlendirilmesi ve sizinle iletişime geçilmesi,',
              'Randevuların planlanması, onaylanması, değiştirilmesi veya iptal edilmesi,',
              'Danışmanlık hizmetinin sunulması ve takibi,',
              'Bilgi güvenliğinin sağlanması ve kötüye kullanımın önlenmesi,',
              'Hukuki yükümlülüklerin yerine getirilmesi.',
            ],
          },
          {
            heading: '4. Hukuki sebepler',
            paragraphs: [
              'Kişisel verileriniz; KVKK md. 5/2 (c) “bir sözleşmenin kurulması veya ifasıyla doğrudan doğruya ilgili olması”, (ç) “veri sorumlusunun hukuki yükümlülüğünü yerine getirebilmesi için zorunlu olması” ve (f) “ilgili kişinin temel hak ve özgürlüklerine zarar vermemek kaydıyla, veri sorumlusunun meşru menfaatleri için veri işlenmesinin zorunlu olması” hukuki sebeplerine dayanılarak işlenir. Açık rızanın gerektiği hâllerde ayrıca açık rızanız alınır.',
            ],
          },
          {
            heading: '5. Aktarım',
            paragraphs: [
              `Kişisel verileriniz, yukarıdaki amaçlarla sınırlı olarak ve KVKK md. 8 ve 9’daki şartlara uygun şekilde; yetkili kamu kurum ve kuruluşlarına, veri işleyen sıfatıyla web sitesi ve randevu sisteminin teknik hizmetlerini yürüten ${DEVELOPER.name}’e ve barındırma (hosting) hizmeti alınan ${HOSTING.name}’a aktarılabilir. Web sitesi ve randevu sistemi, ${HOSTING.name}’ın ${HOSTING.country}’deki sunucularında barındırılır.`,
            ],
          },
          {
            heading: '6. Toplama yöntemi',
            paragraphs: ['Kişisel verileriniz; web sitesindeki randevu talep formu, telefon, e-posta ve yüz yüze görüşmeler aracılığıyla, kısmen otomatik ve otomatik olmayan yollarla toplanır.'],
          },
          { heading: '7. KVKK md. 11 kapsamındaki haklarınız', list: rights },
          {
            heading: '8. Başvuru',
            paragraphs: [
              `Haklarınıza ilişkin taleplerinizi, Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ’e uygun olarak ${email} adresine veya ${address} adresine yazılı olarak iletebilirsiniz. Başvurular en geç otuz gün içinde ücretsiz olarak sonuçlandırılır.${emailNote}`,
            ],
          },
        ],
      };
    case 'consent':
      return {
        title: 'Açık Rıza',
        accent: 'Metni',
        description: 'Randevu formunda paylaşılan bilgilerin işlenmesine ilişkin isteğe bağlı açık rıza metni (taslak).',
        intro:
          'Bu metin, randevu talep formunda isteğe bağlı olarak işaretleyebileceğiniz açık rıza beyanını açıklar. Açık rıza vermemeniz randevu talebinde bulunmanıza engel değildir.',
        sections: [
          {
            heading: 'Rızanın kapsamı',
            paragraphs: [
              `KVKK Aydınlatma Metni’ni okuduğumu; randevu formundaki mesaj alanında kendi isteğimle paylaştığım bilgilerin, randevu talebimin değerlendirilmesi ve görüşmenin planlanması amacıyla ${controller} tarafından işlenmesine özgür irademle açık rıza verdiğimi kabul ederim.`,
            ],
          },
          {
            heading: 'Rızanın geri alınması',
            paragraphs: [`Açık rızanızı dilediğiniz zaman ${email} adresine bildirerek geri alabilirsiniz. Geri alma, geri alma tarihinden önce yapılan işlemleri etkilemez.`],
          },
          {
            heading: 'Sağlık verileri hakkında',
            paragraphs: [
              'Danışmanlık sürecinde ölçüm, beslenme takibi gibi sağlık verisi niteliğindeki bilgilerin işlenmesi gerekirse, bu işlem için ayrıca ve açıkça bilgilendirme yapılır; ilgili hukuki şartlar sağlanmadan bu veriler toplanmaz.',
            ],
          },
        ],
      };
    case 'privacy':
      return {
        title: 'Gizlilik',
        accent: 'Politikası',
        description: 'Web sitesi ve mobil uygulama kullanımı sırasında kişisel verilerin korunmasına ilişkin gizlilik politikası (taslak).',
        intro: 'Bu politika, web sitesini ziyaret ettiğinizde ve randevu talep formunu kullandığınızda bilgilerinizin nasıl korunduğunu özetler.',
        sections: [
          { heading: 'Veri minimizasyonu', paragraphs: ['Yalnızca randevu talebinizi değerlendirmek için gerekli olan bilgiler istenir. Formda sağlık bilgisi talep edilmez.'] },
          {
            heading: 'Güvenlik önlemleri',
            list: [
              'Site ile tarayıcınız arasındaki iletişim şifreli bağlantı (HTTPS) üzerinden yapılır.',
              'Yönetim paneline yalnızca yetkili kişiler, güvenli oturum ile erişebilir.',
              'Hassas nitelikteki kayıtlar depolamada şifrelenir; erişimler kayıt altına alınır.',
            ],
          },
          { heading: 'Saklama süresi', paragraphs: ['Kişisel veriler, işleme amacının gerektirdiği süre ve ilgili mevzuatta öngörülen süreler boyunca saklanır; süre sonunda silinir, yok edilir veya anonim hâle getirilir. [Saklama süreleri veri saklama ve imha politikasına göre belirtilmelidir.]'] },
          {
            heading: 'Mobil uygulama',
            paragraphs: [
              '“Nida Akın” mobil uygulaması (iOS ve Android) web sitesindeki danışan hesabının ve yönetim panelinin karşılığıdır; aynı sunucuyu ve aynı güvenlik kurallarını kullanır. Uygulamada kayıt olunmaz; danışan hesapları diyetisyen tarafından açılır.',
              'Oturum anahtarı cihazın güvenli deposunda (iOS Anahtar Zinciri / Android Keystore) saklanır. İsteğe bağlı Face ID / parmak izi kilidi cihazda çalışır; biyometrik veriniz uygulamaya ya da sunucuya iletilmez.',
              'Bildirimlere izin verirseniz cihazınızın bildirim adresi (push token) yalnızca size randevu, liste ve mesaj bildirimleri göndermek için saklanır; bildirimler Expo (Expo, Inc.) altyapısı üzerinden Apple ve Google bildirim servislerine iletilir. Çıkış yaptığınızda bu adres silinir.',
              'İnternetsiz kullanım için danışan uygulamasında beslenme listeleriniz, tarifleriniz, randevularınız ve ölçümleriniz cihazınızda en fazla 7 gün saklanır; çıkış yaptığınızda silinir. Personel uygulamasında klinik veriler cihaza kaydedilmez.',
              'Kamera ve fotoğraf erişimi yalnızca siz dosya ya da görsel yüklemeyi seçtiğinizde istenir. Uygulamada reklam, analiz veya izleme aracı bulunmaz; verileriniz üçüncü taraflarla pazarlama amacıyla paylaşılmaz.',
            ],
          },
          { heading: 'Üçüncü taraf hizmetler', paragraphs: ['İletişim sayfasında harita gösterilmesi hâlinde harita, Google tarafından sağlanır ve Google’ın gizlilik koşullarına tabidir.'] },
          { heading: 'İletişim', paragraphs: [`Gizlilikle ilgili sorularınız için: ${email}`] },
        ],
      };
    case 'cookies':
      return {
        title: 'Çerez',
        accent: 'Politikası',
        description: 'Web sitesinde kullanılan çerezlere ilişkin bilgilendirme (taslak).',
        intro: 'Bu sitede reklam veya izleme amaçlı çerez kullanılmaz.',
        sections: [
          {
            heading: 'Kullanılan çerezler',
            list: [
              'Zorunlu oturum çerezi (yalnızca yönetim paneli): Yetkili kullanıcıların güvenli oturumunu sürdürmek için kullanılır. Ziyaretçiler için oluşturulmaz.',
            ],
          },
          {
            heading: 'Üçüncü taraf içerikler',
            paragraphs: ['İletişim bölümünde Google Haritalar gösterildiğinde, Google kendi çerezlerini kullanabilir. Bu çerezler Google’ın politikalarına tabidir.'],
          },
          { heading: 'Çerez tercihleri', paragraphs: ['Tarayıcınızın ayarlarından çerezleri silebilir veya engelleyebilirsiniz. Zorunlu çerezlerin engellenmesi yönetim panelinin çalışmasını engeller.'] },
        ],
      };
  }
}
