/**
 * Görsel varlıklar — tek yerden değiştirilebilir.
 * Gerçek portre fotoğrafı geldiğinde: public/images/ içine koyun ve PORTRAIT'i doldurun
 * (ör. { src: '/images/nida-akin-portre.webp', width: 1200, height: 1500, alt: 'Diyetisyen Nida Akın' }).
 * Doldurulana kadar sitede zarif bir yer tutucu gösterilir; stok fotoğraf KULLANILMAZ.
 */
export interface MediaImage { src: string; width: number; height: number; alt: string }

export const PORTRAIT: MediaImage | null = null;

/** Gerçek mekân fotoğrafları (scripts/prepare-images.py ile üretilir) */
export const VENUE = {
  facade: {
    base: '/images/mekan-cephe',
    widths: [480, 668, 1000],
    width: 668,
    height: 828,
    alt: 'Nida Akın Diyetisyen mekânının gece görünümü: siyah doğramalı geniş cam cephe, içeriden yayılan sıcak ışık',
  },
  table: {
    base: '/images/mekan-masa',
    widths: [390, 585],
    width: 390,
    height: 464,
    alt: 'Mekânın cam cephesinin önünde ahşap masa ve sandalyeler, sıcak iç aydınlatma',
  },
  sign: {
    base: '/images/mekan-tabela',
    widths: [210, 315],
    width: 210,
    height: 352,
    alt: 'Mekânın cam cephesindeki hizmet yazıları, aralarında "Beslenme Danışmanlığı"',
  },
} as const;
