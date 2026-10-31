/** Varsayılan site içeriği (zod içermez — herkese açık sitenin ana paketine girer) */
import type { Settings } from './settings';
import { siteConfig } from './site-config';

export const defaultSettings: Settings = {
  hero: {
    eyebrow: 'Sağlıklı yaşam, doğru beslenme ile başlar',
    titleLine1: 'Nida Akın',
    titleLine2: 'Diyetisyen',
    description: 'Daha sağlıklı, dengeli ve enerjik bir yaşam için size özel beslenme danışmanlığı.',
    primaryCta: 'Randevu Al',
    secondaryCta: 'Yakından Tanıyın',
    features: ['Kişiye Özel Beslenme Planı', 'Sağlıklı Yaşam Danışmanlığı', 'Sürdürülebilir Beslenme'],
  },
  intro: {
    heading: 'İyi hissetmek, kendin için attığın küçük bir adımla başlar.',
    body:
      'Beslenme; listelerden, yasaklardan ve kısa süreli kararlardan çok daha fazlası. Günlük ritminizi, sevdiğiniz tatları ve hayatınızın gerçek koşullarını anlamadan kalıcı bir değişim planlanamaz. Bu yüzden her görüşme, sizi dinlemekle başlar.',
    aside: 'Sizin hayatınıza uyan bir plan — tersi değil.',
  },
  about: {
    eyebrow: 'Hakkımda',
    heading: 'Dinleyen, birlikte planlayan, süreç boyunca yanınızda olan bir danışmanlık.',
    lead:
      'Beslenmeyi bir disiplin cezası olarak değil, kendinize gösterdiğiniz özenin bir parçası olarak görüyorum. Amacım, sizin için işleyen ve uzun vadede sürdürebileceğiniz alışkanlıkları birlikte bulmak.',
    paragraphs: [
      'Danışmanlık sürecinde önce sizi tanımaya odaklanıyorum: gününüz nasıl geçiyor, neleri seviyorsunuz, nerede zorlanıyorsunuz? Bu sorulara verdiğiniz cevaplar, planın kendisi kadar önemli.',
      'Hazır listeler yerine; yaşam tempounuza, alışkanlıklarınıza ve hedeflerinize göre şekillenen, gerektiğinde birlikte güncellediğimiz bir yol haritası hazırlıyoruz.',
    ],
    pillars: [
      { title: 'Önce dinlemek', body: 'Her plan, sizin hikâyenizi ve günlük ritminizi anlamakla başlar.' },
      { title: 'Gerçekçi hedefler', body: 'Küçük ama kalıcı adımlar; kısa süreli değil, sürdürülebilir değişim.' },
      { title: 'Yargısız yaklaşım', body: 'Mükemmel bir beslenme değil, size iyi gelen bir denge arıyoruz.' },
    ],
    // Gerçek eğitim, sertifika ve deneyim bilgileri doğrulandıktan sonra panelden eklenmelidir.
    credentials: [],
    signature: 'Nida Akın',
  },
  approach: {
    heading: 'Yasaklarla değil, dengeyle.',
    subheading: 'Beslenme, hayatından vazgeçmek değil; hayatına iyi gelecek alışkanlıklar kazanmaktır.',
    pillars: [
      { title: 'Sürdürülebilirlik', body: 'Birkaç hafta değil, yıllar boyunca uygulanabilecek alışkanlıklar üzerine kurulu bir yaklaşım.' },
      { title: 'Kişiye özel planlama', body: 'Yaşam tarzınız, tercihleriniz ve hedefleriniz doğrultusunda size özel hazırlanan bir plan.' },
      { title: 'Dengeli yaşam', body: 'Sofradaki keyfi korurken bedeninize iyi gelecek seçimleri birlikte keşfetmek.' },
    ],
  },
  process: {
    heading: 'Süreç nasıl işliyor?',
    intro: 'İlk görüşmeden takip sürecine kadar her adım, sizin ihtiyaçlarınıza göre şekillenir.',
    steps: [
      { title: 'Tanışma', body: 'İhtiyaçların ve hedeflerin belirlenmesi.' },
      { title: 'Değerlendirme', body: 'Kişiye özel beslenme ihtiyaçlarının değerlendirilmesi.' },
      { title: 'Planlama', body: 'Bireysel ihtiyaçlara uygun beslenme planının hazırlanması.' },
      { title: 'Takip', body: 'Sürecin değerlendirilmesi ve gerektiğinde güncellenmesi.' },
    ],
  },
  cta: {
    heading: 'Değişim, kendine ayırdığın zamanla başlar.',
    body: 'Sağlıklı yaşam yolculuğuna ilk adımını at.',
    button: 'Randevu Oluştur',
  },
  contact: { ...siteConfig.contact },
  social: { ...siteConfig.social },
  business: { ...siteConfig.business },
  seo: {
    defaultTitle: 'Nida Akın — Diyetisyen',
    titleSuffix: ' | Nida Akın Diyetisyen',
    defaultDescription:
      'Diyetisyen Nida Akın ile kişiye özel, sürdürülebilir beslenme danışmanlığı. Yasaklarla değil, dengeyle. Randevu talebinizi çevrim içi oluşturun.',
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
  kvkk: {
    retentionMonths: 36,
    noticeVersion: '2026-10-taslak',
    legalReviewCompleted: false,
  },
};
