// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Logo — web'deki LogoMark ile aynı çizim (src/components/icons/Logo.tsx) */
import Svg, { Path } from 'react-native-svg';
import { View } from 'react-native';
import { colors, fonts } from '@/theme';
import { T } from './ui/Text';

const LOGO_PATHS = {
  body: 'M31 19.2C25 14.6 14.2 14.6 10.6 23C6.6 32.2 9.6 45 16.6 52.6C20.6 57 25.6 57.6 29.1 55.6C30.9 54.6 33.1 54.6 34.9 55.6C38.4 57.6 43.4 57 47.4 52.6C54.4 45 57 33.2 53.2 24.6C50.8 19.6 46 17.1 41 17.5',
  stem: 'M32.4 19.6C32.3 15.4 33.3 11.4 35.8 7.8',
  leaf: 'M35 10.4C38.6 4.8 45.8 3.2 51 4.6C48.9 10.8 41.9 13.8 35 10.4Z',
  vein: 'M36.6 9.8C40.8 8.1 44.6 6.6 48.2 5.8',
};

export function LogoMark({ size = 44, color = colors.rose, strokeWidth = 1.5 }: { size?: number; color?: string; strokeWidth?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d={LOGO_PATHS.body} />
      <Path d={LOGO_PATHS.stem} />
      <Path d={LOGO_PATHS.leaf} />
      <Path d={LOGO_PATHS.vein} strokeWidth={strokeWidth * 0.7} />
    </Svg>
  );
}

export function Logo({ tone = 'light', size = 'md' }: { tone?: 'light' | 'dark'; size?: 'md' | 'lg' }) {
  const lg = size === 'lg';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }} accessibilityLabel="Nida Akın, Diyetisyen" accessible>
      <LogoMark size={lg ? 56 : 44} />
      <View>
        <T style={{ fontFamily: fonts.display, fontSize: lg ? 34 : 26, lineHeight: lg ? 36 : 28, color: tone === 'light' ? colors.cream : colors.espresso }}>Nida Akın</T>
        <T style={{ fontFamily: fonts.medium, fontSize: 10, letterSpacing: 4, color: tone === 'light' ? colors.mist : colors.taupe, marginTop: 2 }}>DİYETİSYEN</T>
      </View>
    </View>
  );
}
