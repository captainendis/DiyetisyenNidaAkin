// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Adım göstergesi (web: src/components/forms/StepIndicator.tsx) */
import { StyleSheet, View } from 'react-native';
import { Icon, T } from '@/components/ui';
import { colors, fonts, space } from '@/theme';
import type { Step } from './types';

const STEP_LABELS = ['Görüşme', 'Zaman', 'Bilgilerin'];

export function StepIndicator({ step }: { step: Step }) {
  return (
    <View style={styles.row} accessibilityRole="progressbar" accessibilityLabel={`Adım ${Math.min(step, 3)} / 3: ${STEP_LABELS[Math.min(step, 3) - 1]}`}>
      {STEP_LABELS.map((l, i) => {
        const n = i + 1;
        const active = step === n;
        const done = step > n;
        return (
          <View key={l} style={styles.item}>
            <View style={[styles.dot, done ? styles.done : active ? styles.active : null]}>
              {done ? (
                <Icon name="check" size={13} color={colors.cream} />
              ) : (
                <T style={{ fontFamily: fonts.semibold, fontSize: 12, color: active ? colors.text : colors.muted }}>{n}</T>
              )}
            </View>
            <T style={{ fontFamily: fonts.medium, fontSize: 13, color: active ? colors.text : colors.muted }}>{l}</T>
            {i < STEP_LABELS.length - 1 ? <View style={styles.line} /> : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.sm, marginBottom: space.xl },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { width: 26, height: 26, borderRadius: 13, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  active: { borderColor: colors.espresso },
  done: { borderColor: colors.espresso, backgroundColor: colors.espresso },
  line: { width: 16, height: StyleSheet.hairlineWidth, backgroundColor: colors.mist },
});
