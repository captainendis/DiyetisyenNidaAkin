// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Tarif görseli, kütüphane kartı ve rozetleri (web: RecipeCard.tsx) */
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Icon, T, type IconName } from '@/components/ui';
import { colors, fonts, radius, shadow, space } from '@/theme';
import { RECIPE_CATEGORY_LABEL, recipeMeta, type Recipe } from '@shared/recipe';
import { recipeImage } from './api';

export function RecipeThumb({ recipe, style, size = 480 }: { recipe: Pick<Recipe, 'imageBase'>; style?: StyleProp<ViewStyle>; size?: 480 | 960 }) {
  const uri = recipeImage(recipe.imageBase, size);
  return (
    <View style={[styles.thumb, style]}>
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} accessibilityIgnoresInvertColors />
      ) : (
        <Icon name="coffee" size={22} color={colors.mist} />
      )}
    </View>
  );
}

interface BadgeDef {
  icon: IconName;
  text: string;
  bg: string;
  fg: string;
}

/** Yayında / ana sayfada / kişiye özel / varyasyon rozetleri */
export function recipeBadges(recipe: Recipe): BadgeDef[] {
  return [
    recipe.isPublished && { icon: 'globe', text: 'Yayında', bg: '#2F6B4F', fg: '#FFFFFF' },
    recipe.isFeatured && { icon: 'home', text: 'Ana sayfada', bg: colors.gold, fg: colors.espresso },
    recipe.client && { icon: 'user', text: 'Kişiye özel', bg: colors.rose, fg: colors.espresso },
    !recipe.client && recipe.parentId && { icon: 'git-branch', text: 'Varyasyon', bg: 'rgba(255,255,255,0.94)', fg: colors.cocoa },
    !recipe.parentId && recipe.variantCount > 0 && { icon: 'git-branch', text: `${recipe.variantCount} varyasyon`, bg: 'rgba(255,255,255,0.94)', fg: colors.cocoa },
  ].filter(Boolean) as BadgeDef[];
}

export function RecipeBadges({ recipe, style }: { recipe: Recipe; style?: StyleProp<ViewStyle> }) {
  const items = recipeBadges(recipe);
  if (!items.length) return null;
  return (
    <View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }, style]}>
      {items.map((b) => (
        <View key={b.text} style={[styles.badge, { backgroundColor: b.bg }]}>
          <Icon name={b.icon} size={11} color={b.fg} />
          <T style={{ fontFamily: fonts.bold, fontSize: 11, lineHeight: 14, color: b.fg }}>{b.text}</T>
        </View>
      ))}
    </View>
  );
}

/** Kütüphane kartı; `selected` verilirse seçilebilir kart olarak davranır */
export function RecipeCard({ recipe, onPress, selected }: { recipe: Recipe; onPress?: () => void; selected?: boolean }) {
  const meta = recipeMeta(recipe).slice(0, 2);
  const who = [recipe.client ? `${recipe.client.firstName} ${recipe.client.lastName} için` : '', recipe.variantNote].filter(Boolean).join(' · ');
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={selected === undefined ? 'button' : 'checkbox'}
      accessibilityState={selected === undefined ? undefined : { checked: selected }}
      accessibilityLabel={`${recipe.title}, ${RECIPE_CATEGORY_LABEL[recipe.category]}`}
      style={({ pressed }) => [styles.card, selected && styles.cardSel, pressed && { opacity: 0.85 }]}
    >
      <RecipeThumb recipe={recipe} style={{ aspectRatio: 4 / 3, width: '100%' }} />
      <RecipeBadges recipe={recipe} style={{ position: 'absolute', top: 8, left: 8, right: selected !== undefined ? 40 : 8 }} />
      {selected !== undefined ? (
        <View style={[styles.check, selected ? { backgroundColor: colors.espresso } : { backgroundColor: 'rgba(255,255,255,0.92)' }]}>
          {selected ? <Icon name="check" size={15} color={colors.cream} /> : null}
        </View>
      ) : null}
      <View style={{ padding: space.md, gap: 3, flex: 1 }}>
        <T variant="overline" color={colors.muted} style={{ fontSize: 10 }}>{RECIPE_CATEGORY_LABEL[recipe.category]}</T>
        <T variant="subheading" numberOfLines={2}>{recipe.title}</T>
        {who ? <T variant="caption" weight="semibold" color={colors.cocoa} numberOfLines={2}>{who}</T> : null}
        {meta.length ? <T variant="caption" style={{ fontSize: 12 }} numberOfLines={2}>{meta.join(' · ')}</T> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  thumb: { backgroundColor: '#EFE8DD', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 2 },
  card: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, ...shadow.card },
  cardSel: { borderWidth: 2, borderColor: colors.espresso },
  check: { position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF' },
});
