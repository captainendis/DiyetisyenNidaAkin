// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// Hareket yöneticisiyle uyumlu kaydırma: içindeki sürükleme (Sortable) başlayınca kaydırma durur
import { GestureHandlerRootView, ScrollView } from 'react-native-gesture-handler';
import { colors, radius, space } from '@/theme';
import { IconButton } from './Button';
import { T } from './Text';

/**
 * Alttan açılan sayfa (form, seçim, ayrıntı). Web'deki Modal bileşeninin karşılığı.
 * `footer`: altta sabit butonlar.
 */
export function Sheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  footer,
  full,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Ekranın neredeyse tamamını kaplasın (uzun formlar) */
  full?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose} statusBarTranslucent>
      {/* Modal ayrı bir kök görünümdür: içindeki hareketler (Android) kendi kökünü ister */}
      <GestureHandlerRootView style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Kapat" />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.wrap, full && { height: '92%' }]}>
          <View style={[styles.sheet, full && { flex: 1 }]}>
            <View style={styles.grabber} />
            <View style={styles.head}>
              <View style={{ flex: 1 }}>
                <T variant="title">{title}</T>
                {subtitle ? <T variant="caption">{subtitle}</T> : null}
              </View>
              <IconButton name="x" label="Kapat" onPress={onClose} />
            </View>
            <ScrollView
              style={full ? { flex: 1 } : { maxHeight: 560 }}
              contentContainerStyle={{ padding: space.lg, paddingTop: space.sm, gap: space.md, paddingBottom: footer ? space.lg : insets.bottom + space.xl }}
              keyboardShouldPersistTaps="handled"
            >
              {children}
            </ScrollView>
            {footer ? <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space.md) }]}>{footer}</View> : null}
          </View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(33,23,16,0.45)', justifyContent: 'flex-end' },
  wrap: { width: '100%' },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, overflow: 'hidden' },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line, marginTop: 8 },
  head: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.sm, gap: space.md },
  footer: { flexDirection: 'row', gap: space.md, paddingHorizontal: space.lg, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, backgroundColor: colors.bg },
});
