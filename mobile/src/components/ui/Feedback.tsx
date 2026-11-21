// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Animated, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius, space, toneColors, type Tone } from '@/theme';
import { errorMessage } from '@/lib/api';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { T } from './Text';

export function Loading({ label }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.gold} />
      {label ? <T variant="caption">{label}</T> : null}
    </View>
  );
}

export function ErrorView({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <View style={styles.center}>
      <Icon name="alert-circle" size={28} color={colors.dangerInk} />
      <T center muted style={{ maxWidth: 300 }}>{errorMessage(error)}</T>
      {onRetry ? <Button title="Tekrar dene" variant="secondary" size="sm" onPress={onRetry} /> : null}
    </View>
  );
}

export function Empty({ icon = 'inbox', title, text, action }: { icon?: IconName; title: string; text?: string; action?: ReactNode }) {
  return (
    <View style={[styles.center, { paddingVertical: space.xxl }]}>
      <View style={styles.emptyIcon}>
        <Icon name={icon} size={22} color={colors.goldInk} />
      </View>
      <T variant="heading" center>{title}</T>
      {text ? <T center muted style={{ maxWidth: 300 }}>{text}</T> : null}
      {action}
    </View>
  );
}

/** Durum rozeti */
export function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const c = toneColors[tone];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <T style={{ color: c.fg, fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16 }}>{label}</T>
    </View>
  );
}

/** Bilgi/uyarı kutusu */
export function Notice({ tone = 'info', title, text, icon }: { tone?: Tone; title?: string; text: ReactNode; icon?: IconName }) {
  const c = toneColors[tone];
  return (
    <View style={[styles.notice, { backgroundColor: c.bg }]}>
      <Icon name={icon ?? (tone === 'danger' ? 'alert-triangle' : tone === 'success' ? 'check-circle' : 'info')} size={18} color={c.fg} />
      <View style={{ flex: 1, gap: 2 }}>
        {title ? <T variant="label" color={c.fg}>{title}</T> : null}
        {typeof text === 'string' ? <T variant="caption" color={c.fg}>{text}</T> : text}
      </View>
    </View>
  );
}

/** Onay penceresi (Promise) */
export function confirm(opts: { title: string; message?: string; confirmText?: string; destructive?: boolean }): Promise<boolean> {
  // Web önizlemesi (geliştirme/QA): react-native-web'de Alert yoktur → tarayıcı onayı
  if (Platform.OS === 'web') return Promise.resolve(globalThis.confirm?.(`${opts.title}${opts.message ? `\n\n${opts.message}` : ''}`) ?? false);
  return new Promise((resolve) => {
    Alert.alert(opts.title, opts.message, [
      { text: 'Vazgeç', style: 'cancel', onPress: () => resolve(false) },
      { text: opts.confirmText ?? 'Onayla', style: opts.destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}

// ───────────────────────── Toast ─────────────────────────

type ToastKind = 'success' | 'error' | 'info';
const ToastCtx = createContext<(msg: string, kind?: ToastKind) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [msg, setMsg] = useState<{ text: string; kind: ToastKind } | null>(null);
  const anim = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (text: string, kind: ToastKind = 'success') => {
      if (timer.current) clearTimeout(timer.current);
      setMsg({ text, kind });
      Animated.timing(anim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      timer.current = setTimeout(() => {
        Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => setMsg(null));
      }, 2600);
    },
    [anim],
  );

  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg ? (
        <Animated.View
          pointerEvents="none"
          accessibilityLiveRegion="polite"
          style={[
            styles.toast,
            { bottom: insets.bottom + 72, opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] },
          ]}
        >
          <Icon name={msg.kind === 'error' ? 'alert-circle' : msg.kind === 'info' ? 'info' : 'check'} size={17} color={msg.kind === 'error' ? colors.rose : colors.cream} />
          <T style={{ color: colors.cream, flex: 1 }}>{msg.text}</T>
        </Animated.View>
      ) : null}
    </ToastCtx.Provider>
  );
}

/** const toast = useToast(); toast('Kaydedildi'); toast(errorMessage(e), 'error') */
export const useToast = () => useContext(ToastCtx);

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.xl, minHeight: 200 },
  emptyIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#F1E7D6', alignItems: 'center', justifyContent: 'center' },
  badge: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  notice: { flexDirection: 'row', gap: space.md, padding: space.md, borderRadius: radius.md, alignItems: 'flex-start' },
  toast: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    backgroundColor: colors.espresso,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
});
