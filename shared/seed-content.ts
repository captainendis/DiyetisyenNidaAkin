/** İlk kurulum içerikleri. Hizmet metinleri TASLAKTIR — sunulan hizmetler doğrulandıktan sonra panelden düzenlenmelidir. */
export const seedServices = [
  {
    slug: 'kisiye-ozel-beslenme-danismanligi',
    title: 'Kişiye Özel Beslenme Danışmanlığı',
    icon: 'plate',
    summary: 'Gününüze ve sevdiğiniz yemeklere göre birlikte yazdığımız tek sayfalık beslenme planı.',
    description:
      'İlk görüşmede gününüzün nasıl geçtiğini, neleri sevdiğinizi ve hangi saatlerde zorlandığınızı konuşuyoruz. Plan bu konuşmadan çıkar ve takip görüşmelerinde birlikte güncellenir.',
  },
  {
    slug: 'kilo-yonetimi',
    title: 'Kilo Yönetimi',
    icon: 'scale',
    summary: 'Ulaştığınız kiloyu koruyabileceğiniz alışkanlıklar üzerine kurulu bir program.',
    description:
      'Hedefe giden yolu, bir sonraki görüşmeye kadar uygulanabilecek küçük adımlara bölüyoruz. Her takip görüşmesinde işleyen adımları koruyup zorlananları değiştiriyoruz.',
  },
  {
    slug: 'saglikli-yasam-beslenmesi',
    title: 'Sağlıklı Yaşam Beslenmesi',
    icon: 'leaf',
    summary: 'Kilo hedefi olmadan öğün düzenini ve besin çeşitliliğini gözden geçirmek isteyenler için.',
    description:
      'Gün içindeki öğün saatlerinize ve tabağınızdaki çeşitliliğe birlikte bakıyoruz. Küçük değişikliklerle başlayıp hangilerinin size iyi geldiğini takip ediyoruz.',
  },
  {
    slug: 'surdurulebilir-beslenme-aliskanliklari',
    title: 'Sürdürülebilir Beslenme Alışkanlıkları',
    icon: 'cycle',
    summary: 'Yoğun iş günlerinde ve davetlerde de uygulayabileceğiniz bir beslenme düzeni.',
    description:
      'Planı hafta içi mesainize ve hafta sonu sofranıza göre kuruyoruz. Zorlandığınız anları takip görüşmelerinde birlikte ele alıyoruz.',
  },
  {
    slug: 'online-beslenme-danismanligi',
    title: 'Online Beslenme Danışmanlığı',
    icon: 'screen',
    summary: 'Yüz yüze gelemediğiniz dönemlerde görüntülü görüşmeyle sürdürülen danışmanlık.',
    description:
      'Yüz yüze görüşmeye vakit bulamadığınız ya da farklı bir şehirde olduğunuz durumlarda görüşmeler çevrim içi planlanabilir.',
  },
  {
    slug: 'beslenme-takibi',
    title: 'Beslenme Takibi',
    icon: 'notebook',
    summary: 'Düzenli takip görüşmeleriyle planın gidişatınıza göre güncellenmesi.',
    description:
      'Takip görüşmelerinde neyin işe yaradığını ve neyin zorladığını konuşur, planı birlikte yeniden düzenleriz.',
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
