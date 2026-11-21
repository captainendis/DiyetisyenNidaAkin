// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Hizmet simgeleri — web'deki özel çizgi ikonların (src/components/icons/ServiceIcon.tsx) birebir aynısı.
 * 48×48 ızgara, 1.25 kontur, yuvarlak uçlar. Anahtarlar: shared/constants.ts → SERVICE_ICONS
 */
import type { ReactNode } from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors } from '@/theme';
import type { ServiceIconKey } from '@shared/constants';

const P: Record<ServiceIconKey, ReactNode> = {
  // Tabak + çatal/bıçak: kişiye özel plan
  plate: (
    <>
      <Circle cx="24" cy="26" r="13" />
      <Circle cx="24" cy="26" r="8.5" opacity={0.55} />
      <Path d="M6 12v9a2.5 2.5 0 0 0 5 0v-9M8.5 12v28" />
      <Path d="M41.5 12c-2.5 1.8-3.5 5-3.5 9v4h3.5M41.5 12v28" />
    </>
  ),
  // Denge: iki kefeli çizgi + yaprak
  scale: (
    <>
      <Path d="M24 9v30M15 39h18" />
      <Path d="M10 17h28" />
      <Path d="M10 17 5.5 27a4.5 4.5 0 0 0 9 0L10 17ZM38 17l-4.5 10a4.5 4.5 0 0 0 9 0L38 17Z" />
      <Path d="M24 9c1.5-3 4.5-4.5 7.5-4-1 3-3.8 4.6-7.5 4Z" />
    </>
  ),
  // Damarlı yaprak: sağlıklı yaşam
  leaf: (
    <>
      <Path d="M9 39C9 22 20 10 39 9c0 19-12 30-30 30Z" />
      <Path d="M9 39 30 18M18 30h7M22 26v-6M26 22h6" opacity={0.7} />
    </>
  ),
  // Döngü: sürdürülebilir alışkanlık
  cycle: (
    <>
      <Path d="M38 20a15 15 0 0 0-27.5-4M10 28a15 15 0 0 0 27.5 4" />
      <Path d="M10.5 9v7h7M37.5 39v-7h-7" />
      <Path d="M24 30c0-4 2-6.5 5.5-7-0.3 3.6-2.4 6-5.5 7Zm0 0c0-3-1.6-5-4.5-5.5.2 2.8 1.9 4.8 4.5 5.5Z" />
    </>
  ),
  // Ekran + konuşma: online danışmanlık
  screen: (
    <>
      <Rect x="6" y="9" width="36" height="23" rx="2" />
      <Path d="M17 39h14M24 32v7" />
      <Path d="M19 19.5a5 5 0 0 1 10 0c0 2.8-2.2 5-5 5h-4.5l1.4-1.8A5 5 0 0 1 19 19.5Z" opacity={0.75} />
    </>
  ),
  // Defter + çizgi grafik: takip
  notebook: (
    <>
      <Path d="M12 6h22a3 3 0 0 1 3 3v30a3 3 0 0 1-3 3H12V6Z" />
      <Path d="M12 6v36M8 12h6M8 20h6M8 28h6M8 36h6" />
      <Path d="M18 31l5-6 4 3 6-8" opacity={0.75} />
    </>
  ),
  apple: (
    <>
      <Path d="M23.3 14.4c-4.5-3.4-12.6-3.4-15.3 2.9-3 6.9-.8 16.5 4.5 22.2 3 3.3 6.7 3.7 9.3 2.2a3.4 3.4 0 0 1 3.4 0c2.6 1.5 6.3 1.1 9.3-2.2 5.3-5.7 7.2-14.6 4.4-21-1.8-3.8-5.4-5.6-9.2-5.3" />
      <Path d="M24.3 14.7c0-3.2.7-6.2 2.6-8.9M26.2 7.8c2.7-4.2 8.1-5.4 12-4.3-1.6 4.6-6.8 6.9-12 4.3Z" />
    </>
  ),
  sprout: (
    <>
      <Path d="M24 42V22" />
      <Path d="M24 26c0-7 4-11 11-12 0 7-4.5 11.5-11 12ZM24 22c0-5.5-3.2-8.8-9-9.5 0 5.5 3.6 9 9 9.5Z" />
      <Path d="M14 42h20" />
    </>
  ),
};

export const SERVICE_ICON_LABEL: Record<ServiceIconKey, string> = {
  plate: 'Tabak',
  scale: 'Denge',
  leaf: 'Yaprak',
  cycle: 'Döngü',
  screen: 'Ekran',
  notebook: 'Defter',
  apple: 'Elma',
  sprout: 'Filiz',
};

export function ServiceIcon({ name, size = 22, color = colors.text }: { name: string; size?: number; color?: string }) {
  // Küçük boyutta ince kontur kaybolmasın: 24 pt altında konturu kalınlaştır
  const sw = size < 28 ? 1.25 * (28 / size) * 0.9 : 1.25;
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      {P[name as ServiceIconKey] ?? P.leaf}
    </Svg>
  );
}
