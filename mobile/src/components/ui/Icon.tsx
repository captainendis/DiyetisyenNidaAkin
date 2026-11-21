// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps } from 'react';
import { colors } from '@/theme';

/** Feather ikon adları (https://feathericons.com) */
export type IconName = ComponentProps<typeof Feather>['name'];

export function Icon({ name, size = 20, color = colors.text }: { name: IconName; size?: number; color?: string }) {
  return <Feather name={name} size={size} color={color} />;
}
