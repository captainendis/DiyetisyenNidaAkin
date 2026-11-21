// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import { Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { colors, fonts } from '@/theme';

export type TextVariant = 'display' | 'title' | 'heading' | 'subheading' | 'body' | 'label' | 'caption' | 'overline';

const variants: Record<TextVariant, TextStyle> = {
  display: { fontFamily: fonts.display, fontSize: 34, lineHeight: 38, color: colors.text, letterSpacing: -0.3 },
  title: { fontFamily: fonts.display, fontSize: 26, lineHeight: 30, color: colors.text },
  heading: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 23, color: colors.text },
  subheading: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 21, color: colors.text },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.text },
  label: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18, color: colors.text },
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted },
  overline: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 14, color: colors.goldInk, letterSpacing: 1.4, textTransform: 'uppercase' },
};

export interface TProps extends TextProps {
  variant?: TextVariant;
  color?: string;
  muted?: boolean;
  center?: boolean;
  weight?: 'regular' | 'medium' | 'semibold' | 'bold';
}

/** Metin — `variant` ile tipografi, `muted` ile ikincil renk */
export function T({ variant = 'body', color, muted, center, weight, style, ...rest }: TProps) {
  return (
    <RNText
      {...rest}
      style={[
        variants[variant],
        muted && { color: colors.muted },
        color ? { color } : null,
        center && { textAlign: 'center' },
        weight && { fontFamily: fonts[weight] },
        style,
      ]}
    />
  );
}
