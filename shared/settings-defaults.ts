// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Varsayılan site içeriği (zod içermez — herkese açık sitenin ana paketine girer) */
import type { Settings } from './settings';
import { siteConfig } from './site-config';

export const defaultSettings: Settings = {
  hero: {
    eyebrow: '',
    titleLine1: 'Nida Akın',
    titleLine2: 'Diyetisyen',
    description:
      "Esenyurt Bahçekent'te, Pelin Tek Studio'nun üst katında beslenme danışmanlığı. İlk görüşmede gününüzü ve sevdiğiniz yemekleri konuşup size uyan planı birlikte hazırlıyoruz.",
    primaryCta: 'Randevu Al',
    secondaryCta: 'Yakından Tanıyın',
    features: ['Görüşmeler stüdyonun üst katında', 'Tek sayfa A4 beslenme planı', 'Her öğün için seçenekli liste'],
  },
  intro: {
    heading: 'Her görüşme sizi dinlemekle başlar.',
    body:
      'Hazır bir liste vermeden önce gününüzün nasıl geçtiğini, hangi yemekleri sevdiğinizi ve hangi saatlerde zorlandığınızı konuşuyoruz. Plan bu cevaplardan çıkar: mesai saatleriniz, hafta sonlarınız ve sofranız hesaba katılır.',
    aside: 'Plan, sizin gününüze göre yazılır.',
  },
  about: {
    eyebrow: 'Hakkımda',
    heading: 'Önce sizi tanıyan, planı sizinle birlikte yazan bir danışmanlık.',
    lead:
      'Beslenmeyi kendinize gösterdiğiniz özenin bir parçası olarak görüyorum. Amacım, uzun vadede sürdürebileceğiniz alışkanlıkları sizinle birlikte bulmak.',
    paragraphs: [
      'Danışmanlık sürecinde önce sizi tanımaya odaklanıyorum: gününüz nasıl geçiyor, neleri seviyorsunuz, nerede zorlanıyorsunuz? Bu sorulara verdiğiniz cevaplar, planın kendisi kadar önemli.',
      'Hazır listeler yerine yaşam temponuza ve hedeflerinize göre şekillenen, gerektiğinde birlikte güncellediğimiz bir plan hazırlıyoruz.',
    ],
    pillars: [
      { title: 'Önce dinlemek', body: 'Plan yazılmadan önce gününüzü ve sofranızı konuşuyoruz.' },
      { title: 'Ulaşılabilir hedefler', body: 'Her takip görüşmesinde bir sonraki görüşmeye kadar yapılabilecek küçük adımlar belirliyoruz.' },
      { title: 'Yargısız görüşme', body: 'Ne yediğinizi suçluluk duymadan anlatabileceğiniz bir ortam.' },
    ],
    // Gerçek eğitim, sertifika ve deneyim bilgileri doğrulandıktan sonra panelden eklenmelidir.
    credentials: [],
  },
  approach: {
    heading: 'Yasaklarla değil, dengeyle.',
    subheading: 'Sevdiğiniz yemekleri plandan çıkarmadan, size iyi gelen seçimleri artırıyoruz.',
    pillars: [
      { title: 'Sevdiğiniz yemekler planda', body: 'Vazgeçemediğiniz yemekler listeden silinmez; porsiyonu ve sıklığı birlikte belirlenir.' },
      { title: 'Gerçek gününüze göre', body: 'Mesai saatleri, hafta sonları ve davetler plan yazılırken hesaba katılır.' },
      { title: 'Birlikte güncellenen plan', body: 'Takip görüşmelerinde işlemeyen kısımları birlikte değiştiriyoruz.' },
    ],
  },
  process: {
    heading: 'Süreç nasıl işliyor?',
    intro: 'İlk görüşmeden takip görüşmelerine kadar dört adım.',
    steps: [
      { title: 'Tanışma', body: 'Gününüzü, sevdiğiniz yemekleri ve zorlandığınız saatleri konuşuyoruz.' },
      { title: 'Değerlendirme', body: 'Hedefinizi ve mevcut alışkanlıklarınızı birlikte değerlendiriyoruz.' },
      { title: 'Planlama', body: 'Öğün seçenekleri, su ve hareket hedefiyle tek sayfalık planınızı hazırlıyoruz.' },
      { title: 'Takip', body: 'Takip görüşmelerinde planı işleyen ve zorlanan kısımlara göre güncelliyoruz.' },
    ],
  },
  recipesSection: {
    heading: 'Mutfaktan',
    intro: 'Planlarda en sık önerdiğim pratik ve dengeli tarifler.',
    linkLabel: 'Tüm tarifler',
  },
  cta: {
    heading: 'İlk görüşme için bir saat seçin.',
    body: 'Takvimden uygun bir saat seçebilir ya da saat seçmeden iletişim talebi bırakabilirsiniz. Talebiniz incelenip size dönüş yapılır.',
    button: 'Randevu Al',
  },
  contact: { ...siteConfig.contact },
  social: { ...siteConfig.social },
  business: { ...siteConfig.business },
  seo: {
    defaultTitle: 'Nida Akın — Diyetisyen',
    titleSuffix: ' | Nida Akın Diyetisyen',
    defaultDescription:
      "Esenyurt Bahçekent'te diyetisyen Nida Akın ile beslenme danışmanlığı. Görüşmeler Pelin Tek Studio'nun üst katında; randevu talebinizi çevrim içi oluşturabilirsiniz.",
  },
  appointment: {
    leadTimeHours: 12,
    maxDaysAhead: 45,
    inPersonEnabled: true,
    onlineEnabled: true,
    allowRequestWithoutTime: true,
    formNote:
      'Gönderdiğiniz talep bir ön başvurudur. Randevunuz, uygunluk kontrolünden sonra sizinle iletişime geçilerek kesinleştirilir.',
  },
  media: { hero: null, venue: null, portrait: null },
  kvkk: {
    retentionMonths: 36,
    noticeVersion: '2026-10-taslak',
    legalReviewCompleted: false,
  },
};
