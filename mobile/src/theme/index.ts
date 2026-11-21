// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Tasarım sistemi — web sitesiyle aynı palet (src/styles/index.css).
 * Kontrast kuralı (WCAG AA): açık zeminde metin/ikon için gold, rose ve durum renkleri KULLANILMAZ —
 * "Ink" tonları kullanılır. Ana renkler koyu zeminde metin, açık zeminde yalnızca dolgu/çizgi içindir.
 */
export const colors = {
  espresso: '#211710',
  cocoa: '#302219',
  umber: '#3B2B20',
  cream: '#F4EBDD',
  ivory: '#FAF6EF',
  sand: '#EBDFCC',
  rose: '#DDAFA0',
  roseDeep: '#C99282',
  gold: '#B99569',
  mist: '#B9A99A',
  taupe: '#6E5A4B',
  goldInk: '#7F6239',
  roseInk: '#9A5646',

  bg: '#F5F1EA',
  surface: '#FFFFFF',
  line: '#E7DFD3',
  muted: '#6B5C50',
  text: '#302219',

  success: '#6C9275',
  warning: '#D5A35B',
  danger: '#C56F6F',
  info: '#7D8FA6',
  successInk: '#3D6447',
  warningInk: '#85591B',
  dangerInk: '#A2403B',
  infoInk: '#4A5C74',
  successBg: '#E6EFE8',
  warningBg: '#F7EBD8',
  dangerBg: '#F6E3E1',
  infoBg: '#E5EAF0',
} as const;

export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'gold' | 'rose';

export const toneColors: Record<Tone, { bg: string; fg: string }> = {
  neutral: { bg: '#EFE8DD', fg: colors.muted },
  success: { bg: colors.successBg, fg: colors.successInk },
  warning: { bg: colors.warningBg, fg: colors.warningInk },
  danger: { bg: colors.dangerBg, fg: colors.dangerInk },
  info: { bg: colors.infoBg, fg: colors.infoInk },
  gold: { bg: '#F1E7D6', fg: colors.goldInk },
  rose: { bg: '#F5E3DD', fg: colors.roseInk },
};

/** Yazı tipleri — kök _layout.tsx'te yüklenir */
export const fonts = {
  display: 'CormorantGaramond_500Medium',
  displayItalic: 'CormorantGaramond_500Medium_Italic',
  displayBold: 'CormorantGaramond_600SemiBold',
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 } as const;

export const shadow = {
  card: {
    shadowColor: '#302219',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
} as const;
