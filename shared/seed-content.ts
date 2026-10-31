/** İlk kurulum içerikleri. Hizmet metinleri TASLAKTIR — sunulan hizmetler doğrulandıktan sonra panelden düzenlenmelidir. */
export const seedServices = [
  {
    slug: 'kisiye-ozel-beslenme-danismanligi',
    title: 'Kişiye Özel Beslenme Danışmanlığı',
    icon: 'plate',
    summary: 'Yaşam tarzınıza, alışkanlıklarınıza ve hedeflerinize göre birlikte şekillendirdiğimiz bir beslenme planı.',
    description:
      'Hazır listeler yerine, gününüzün nasıl geçtiğini, neleri sevdiğinizi ve nerede zorlandığınızı konuşarak başlıyoruz. Plan; sizin ritminize uyacak şekilde hazırlanır ve süreç içinde birlikte güncellenir.',
  },
  {
    slug: 'kilo-yonetimi',
    title: 'Kilo Yönetimi',
    icon: 'scale',
    summary: 'Kısa süreli kısıtlamalar yerine, uzun vadede korunabilecek dengeli bir yaklaşım.',
    description:
      'Hedefe giden yolu küçük, uygulanabilir adımlara bölüyoruz. Amaç yalnızca bir sayıya ulaşmak değil; ulaştığınız noktayı koruyabileceğiniz alışkanlıkları kazanmak.',
  },
  {
    slug: 'saglikli-yasam-beslenmesi',
    title: 'Sağlıklı Yaşam Beslenmesi',
    icon: 'leaf',
    summary: 'Enerjinizi, odaklanmanızı ve günlük iyi oluşunuzu destekleyen dengeli beslenme alışkanlıkları.',
    description:
      'Belirli bir kilo hedefi olmadan da beslenmenizi gözden geçirmek isteyebilirsiniz. Öğün düzeni, besin çeşitliliği ve günlük ritim üzerine birlikte çalışıyoruz.',
  },
  {
    slug: 'surdurulebilir-beslenme-aliskanliklari',
    title: 'Sürdürülebilir Beslenme Alışkanlıkları',
    icon: 'cycle',
    summary: 'Yasaklar yerine dengeyle: hayatınızdan vazgeçmeden iyi gelen değişiklikler.',
    description:
      'Sosyal hayat, yoğun iş temposu ve sevdiğiniz tatlar planın bir parçası. Yeme alışkanlıklarınızı fark etmeye ve onları adım adım dönüştürmeye odaklanıyoruz.',
  },
  {
    slug: 'online-beslenme-danismanligi',
    title: 'Online Beslenme Danışmanlığı',
    icon: 'screen',
    summary: 'Bulunduğunuz yerden, görüntülü görüşme ile aynı özenle sürdürülen danışmanlık.',
    description:
      'Yüz yüze görüşmeye vakit bulamadığınız ya da farklı bir şehirde olduğunuz durumlarda, görüşmeler çevrim içi olarak planlanabilir.',
  },
  {
    slug: 'beslenme-takibi',
    title: 'Beslenme Takibi',
    icon: 'notebook',
    summary: 'Düzenli görüşmelerle sürecin değerlendirilmesi ve planın ihtiyaçlarınıza göre güncellenmesi.',
    description:
      'Değişim doğrusal ilerlemez. Takip görüşmelerinde neyin işe yaradığını, neyin zorladığını konuşur ve planı birlikte yeniden düzenleriz.',
  },
] as const;

/** Blog yazıları TASLAK olarak eklenir; uzman onayı (expertReviewed) olmadan yayınlanamaz. */
export const seedPosts = [
  {
    slug: 'tabagini-dengelemenin-basit-yolu',
    category: 'saglikli-beslenme',
    title: 'Tabağını dengelemenin basit yolu',
    excerpt: 'Karmaşık hesaplar yerine, öğünlerinizi gözden geçirirken kullanabileceğiniz sade bir bakış açısı.',
    readingMinutes: 4,
    content: `Dengeli bir tabak, karmaşık hesaplar gerektirmek zorunda değil. Çoğu zaman yalnızca öğünün çeşitliliğine bakmak bile iyi bir başlangıçtır.

## Çeşitliliğe bakın
Tabağınızda farklı renklerde sebzeler, bir protein kaynağı ve tam tahıllar yer alıyor mu? Bu soru, öğünü değerlendirmek için pratik bir ilk adımdır.

## Acele etmeyin
Yemeğe ayırdığınız süre de önemlidir. Yavaş yemek, tokluk hissini fark etmenize yardımcı olabilir.

## Kendinize göre uyarlayın
Herkesin ihtiyacı farklıdır. Size uygun dengeyi bulmak için bir uzmanla görüşmek en sağlıklı yoldur.`,
  },
  {
    slug: 'gun-icinde-su-tuketimini-hatirlamak',
    category: 'gunluk-beslenme',
    title: 'Gün içinde su içmeyi hatırlamak için küçük alışkanlıklar',
    excerpt: 'Yoğun günlerde su içmeyi unutmak kolay. Rutininize eklenebilecek birkaç basit hatırlatıcı.',
    readingMinutes: 3,
    content: `Yoğun bir günde su içmeyi unutmak oldukça yaygındır. Küçük alışkanlıklar bu konuda yardımcı olabilir.

- Masanızda görebileceğiniz bir su şişesi bulundurun.
- Su içmeyi mevcut bir alışkanlığa bağlayın; örneğin her öğünden önce.
- Gün içindeki tüketiminizi fark etmek için basit bir not tutun.

Günlük sıvı ihtiyacı kişiden kişiye değişir. Size özel öneriler için bir uzmana danışın.`,
  },
  {
    slug: 'sofradaki-keyfi-korumak',
    category: 'beslenme-aliskanliklari',
    title: 'Sofradaki keyfi korumak: Yasaklar yerine farkındalık',
    excerpt: 'Beslenme alışkanlıklarını değiştirirken sevdiğiniz tatlardan tamamen vazgeçmek zorunda değilsiniz.',
    readingMinutes: 5,
    content: `Beslenmeyi bir yasaklar listesi olarak görmek, uzun vadede sürdürmeyi zorlaştırabilir.

## Farkındalıkla başlayın
Ne zaman, neden ve nasıl yediğinizi fark etmek; neyi değiştirmek istediğinizi anlamanın ilk adımıdır.

## Küçük adımlar
Bir anda her şeyi değiştirmek yerine, bir alışkanlığı seçip onun üzerinde çalışmak daha kalıcı sonuçlar doğurabilir.

## Destek almak
Kişiye özel bir yol haritası için bir diyetisyenle görüşebilirsiniz.`,
  },
] as const;

/** SSS: yalnızca sistemin gerçek işleyişini anlatan sorular yayında; diğerleri taslak. */
export const seedFaqs = [
  {
    question: 'Randevu talebim gönderildikten sonra ne oluyor?',
    answer: 'Talebiniz "onay bekliyor" olarak kaydedilir. Uygunluk kontrol edildikten sonra sizinle iletişime geçilerek randevunuz kesinleştirilir.',
    isPublished: true,
  },
  {
    question: 'Uygun bir saat göremiyorum, ne yapmalıyım?',
    answer: 'Randevu formunda "Saat seçmeden iletişim talebi bırak" seçeneğini kullanabilirsiniz. Sizin için uygun bir zaman birlikte planlanır.',
    isPublished: true,
  },
  {
    question: 'İlk görüşmeye gelirken neler hazırlamalıyım?',
    answer: '[Bu yanıt diyetisyen tarafından doldurulmalıdır.]',
    isPublished: false,
  },
] as const;
