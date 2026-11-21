// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Karşılama: danışan mı, Nida Akın ve ekibi mi? */
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Logo } from '@/components/Logo';
import { Icon, T, type IconName } from '@/components/ui';
import { colors, fonts, radius, space } from '@/theme';

function Choice({ icon, title, text, onPress }: { icon: IconName; title: string; text: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.choice, pressed && { opacity: 0.85 }]}>
      <View style={styles.choiceIcon}>
        <Icon name={icon} size={20} color={colors.espresso} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <T style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.cream }}>{title}</T>
        <T variant="caption" color={colors.mist}>{text}</T>
      </View>
      <Icon name="arrow-right" size={18} color={colors.rose} />
    </Pressable>
  );
}

export default function Welcome() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { paddingTop: insets.top + space.xxl, paddingBottom: insets.bottom + space.xl }]}>
      <Logo size="lg" />
      <View style={{ gap: space.md, marginTop: 'auto' }}>
        <T style={{ fontFamily: fonts.display, fontSize: 40, lineHeight: 44, color: colors.cream }}>
          Listen, randevun ve ilerlemen{'\n'}
          <T style={{ fontFamily: fonts.displayItalic, fontSize: 40, lineHeight: 44, color: colors.rose }}>cebinde.</T>
        </T>
        <T color={colors.mist} style={{ marginBottom: space.lg }}>Hesaplar diyetisyen tarafından açılır. Bilgilerin şifreli saklanır.</T>
        <Choice icon="user" title="Danışan girişi" text="Beslenme listen, tariflerin, randevuların" onPress={() => router.push({ pathname: '/giris', params: { rol: 'danisan' } })} />
        <Choice icon="briefcase" title="Nida Akın & ekip" text="Yönetim paneli: randevu, danışan, içerik" onPress={() => router.push({ pathname: '/giris', params: { rol: 'panel' } })} />
        <Pressable onPress={() => router.push('/baglanti')} accessibilityRole="link" style={{ alignSelf: 'center', padding: space.md }}>
          <T color={colors.cream} style={{ textDecorationLine: 'underline', fontFamily: fonts.medium }}>Davet bağlantım var</T>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.espresso, paddingHorizontal: space.xl },
  choice: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.cocoa, borderWidth: 1, borderColor: 'rgba(244,235,221,0.08)' },
  choiceIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.rose, alignItems: 'center', justifyContent: 'center' },
});
