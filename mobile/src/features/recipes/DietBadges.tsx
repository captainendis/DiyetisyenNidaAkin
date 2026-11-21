// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Diyet türü etiketleri: ikon + her zaman görünen metin (web: components/recipes/DietBadges.tsx) */
import { View } from 'react-native';
import { Icon, T, type IconName } from '@/components/ui';
import { colors, space } from '@/theme';
import { DIET_TAG_LABEL, DIET_TAG_NOTE, visibleDietTags, type DietTag } from '@shared/recipe';

const DIET_ICON: Record<DietTag, IconName> = {
  VEGAN: 'feather',
  VEGETARIAN: 'sun',
  GLUTEN_FREE: 'slash',
  LACTOSE_FREE: 'droplet',
};

export function DietBadges({ tags }: { tags: DietTag[] | undefined }) {
  const list = visibleDietTags(tags);
  if (!list.length) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: space.lg, rowGap: 6 }} accessibilityLabel="Diyet türü">
      {list.map((t) => (
        <View key={t} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name={DIET_ICON[t]} size={16} color={colors.goldInk} />
          <T variant="label" color={colors.cocoa}>{DIET_TAG_LABEL[t]}</T>
        </View>
      ))}
    </View>
  );
}

/** Ayrıntı: etiket + kısa açıklama */
export function DietNotes({ tags }: { tags: DietTag[] | undefined }) {
  const list = visibleDietTags(tags);
  if (!list.length) return null;
  return (
    <View style={{ gap: space.md }} accessibilityLabel="Diyet türü">
      {list.map((t) => (
        <View key={t} style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start' }}>
          <Icon name={DIET_ICON[t]} size={20} color={colors.goldInk} />
          <T style={{ flex: 1 }} color={colors.cocoa}>
            <T weight="semibold">{DIET_TAG_LABEL[t]}. </T>
            {DIET_TAG_NOTE[t]}
          </T>
        </View>
      ))}
    </View>
  );
}
