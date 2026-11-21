// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Daha fazla — sekmelerde olmayan Hesabım sayfaları (web: PortalShell menüsü), uygulama kilidi ve çıkış.
 * Menü danışanın aldığı hizmete göre şekillenir (yalnızca pilatese gelen danışan beslenme menülerini görmez).
 */
import { router } from 'expo-router';
import { View } from 'react-native';
import { Avatar, Card, ListItem, Screen, Section, SwitchField, T, confirm, useToast, type IconName } from '@/components/ui';
import { useAppLock } from '@/components/AppLock';
import { useAuth, useClient } from '@/lib/auth';
import { space } from '@/theme';

type Item = { href: string; label: string; hint: string; icon: IconName; only?: 'nutrition' | 'pilates' };
const ITEMS: Item[] = [
  { href: '/hesabim/tarifler', label: 'Tarifler', hint: 'Listelerine eklenen tarifler', icon: 'book', only: 'nutrition' },
  { href: '/hesabim/olcumler', label: 'Ölçümler', hint: 'Kilo, mezura ve vücut kompozisyonu', icon: 'trending-down', only: 'nutrition' },
  { href: '/hesabim/mesajlar', label: 'Mesajlar', hint: 'Diyetisyeninin notları', icon: 'message-circle' },
  { href: '/hesabim/dosyalar', label: 'Dosyalar', hint: 'Seninle paylaşılan belgeler', icon: 'paperclip' },
  { href: '/hesabim/hesap', label: 'Hesap', hint: 'E-posta ve şifre', icon: 'user' },
];

export default function MoreTab() {
  const me = useClient();
  const { logout } = useAuth();
  const lock = useAppLock();
  const toast = useToast();
  const items = ITEMS.filter((n) => !n.only || me.programs[n.only]);

  const onLogout = async () => {
    if (await confirm({ title: 'Çıkış yap', message: 'Hesabından çıkış yapılsın mı?', confirmText: 'Çıkış yap', destructive: true })) await logout();
  };

  const onLock = async (v: boolean) => {
    const ok = await lock.setEnabled(v);
    if (!ok) toast('Kimlik doğrulanamadı; kilit açılmadı.', 'error');
  };

  return (
    <Screen>
      <Card style={{ marginBottom: space.xl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <Avatar name={`${me.firstName} ${me.lastName}`} size={48} />
          <View style={{ flex: 1 }}>
            <T variant="heading">{me.firstName} {me.lastName}</T>
            <T variant="caption" numberOfLines={1}>{me.email}</T>
          </View>
        </View>
      </Card>

      <Section title="Hesabım">
        <Card padded={false}>
          {items.map((n, i) => (
            <ListItem key={n.href} icon={n.icon} title={n.label} subtitle={n.hint} last={i === items.length - 1} onPress={() => router.push(n.href)} />
          ))}
        </Card>
      </Section>

      <Section title="Güvenlik">
        <Card>
          <SwitchField
            label="Uygulama kilidi"
            help={lock.available ? 'Uygulama açılırken ve 2 dakikadan uzun arka planda kalınca Face ID / parmak izi istenir.' : 'Bu cihazda Face ID / parmak izi tanımlı değil.'}
            value={lock.enabled}
            disabled={!lock.available}
            onChange={(v) => void onLock(v)}
          />
        </Card>
      </Section>

      <Card padded={false}>
        <ListItem icon="log-out" title="Çıkış yap" danger last onPress={() => void onLogout()} />
      </Card>
    </Screen>
  );
}
