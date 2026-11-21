// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Hizmet simgeleri — web'deki özel çizgi ikonların (src/components/icons/ServiceIcon.tsx) Feather karşılıkları */
import { Icon, type IconName } from '@/components/ui';
import type { ServiceIconKey } from '@shared/constants';

const MAP: Record<ServiceIconKey, IconName> = {
  plate: 'disc',
  scale: 'sliders',
  leaf: 'feather',
  cycle: 'refresh-cw',
  screen: 'monitor',
  notebook: 'book',
  apple: 'heart',
  sprout: 'sunrise',
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

export function ServiceIcon({ name, size = 22, color }: { name: string; size?: number; color?: string }) {
  return <Icon name={MAP[name as ServiceIconKey] ?? MAP.leaf} size={size} color={color} />;
}
