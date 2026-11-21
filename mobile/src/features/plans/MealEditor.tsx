// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Tek öğün: saat, ad, en fazla 3 seçenek (her satır bir besin); sırala / sil (web: PlanEditorForm MealEditor) */
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Icon, IconButton, T, TextField } from '@/components/ui';
import { colors, radius, space } from '@/theme';
import type { PlanMeal } from '@shared/plan';
import type { PlanSetter } from './api';

export function MealEditor({ meal, index, count, set, editable }: { meal: PlanMeal; index: number; count: number; set: PlanSetter; editable: boolean }) {
  const upd = (fn: (m: PlanMeal) => void) => set((d) => fn(d.meals[index]!));
  const move = (to: number) => set((d) => void d.meals.splice(to, 0, d.meals.splice(index, 1)[0]!));
  const dim = (off: boolean) => (off ? colors.line : colors.text);

  return (
    <View style={styles.box}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
        <T variant="overline" style={{ flex: 1 }}>{index + 1}. öğün</T>
        {editable ? (
          <>
            <IconButton name="arrow-up" label="Öğünü yukarı taşı" color={dim(index === 0)} onPress={() => index > 0 && move(index - 1)} />
            <IconButton name="arrow-down" label="Öğünü aşağı taşı" color={dim(index === count - 1)} onPress={() => index < count - 1 && move(index + 1)} />
            <IconButton name="trash-2" label="Öğünü sil" color={count === 1 ? colors.line : colors.dangerInk} onPress={() => count > 1 && set((d) => void d.meals.splice(index, 1))} />
          </>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <View style={{ width: 96 }}>
          <TextField label="Saat" value={meal.time} maxLength={12} placeholder="06.30" editable={editable} keyboardType="numbers-and-punctuation" onChange={(v) => upd((m) => void (m.time = v))} />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="Öğün" value={meal.name} maxLength={40} placeholder="Kahvaltı" editable={editable} onChange={(v) => upd((m) => void (m.name = v))} />
        </View>
      </View>
      {meal.options.map((o, oi) => (
        <View key={oi} style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <T variant="label" style={{ flex: 1 }}>{meal.options.length > 1 ? `${oi + 1}. seçenek` : 'Öğün içeriği'}</T>
            {meal.options.length > 1 && editable ? (
              <Pressable onPress={() => upd((m) => void m.options.splice(oi, 1))} hitSlop={10} accessibilityRole="button" accessibilityLabel={`${oi + 1}. seçeneği kaldır`} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 28 }}>
                <Icon name="x" size={14} color={colors.dangerInk} />
                <T variant="caption" color={colors.dangerInk}>Kaldır</T>
              </Pressable>
            ) : null}
          </View>
          <TextField
            accessibilityLabel={meal.options.length > 1 ? `${oi + 1}. seçenek` : 'Öğün içeriği'}
            rows={5}
            value={o.join('\n')}
            editable={editable}
            placeholder={'Her satıra bir besin\nÖr. 2 haşlanmış yumurta'}
            style={{ fontSize: 14, lineHeight: 20 }}
            onChange={(v) => upd((m) => void (m.options[oi] = v.split('\n').slice(0, 10)))}
          />
        </View>
      ))}
      {meal.options.length < 3 && editable ? (
        <Button title="Seçenek ekle" icon="plus" variant="ghost" size="sm" style={{ alignSelf: 'flex-start' }} onPress={() => upd((m) => void m.options.push([]))} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: '#FBF8F3', padding: space.md },
});
