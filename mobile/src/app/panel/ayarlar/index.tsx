// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Ayarlar — bölümler (web: SettingsPage sekmeleri; izinler web ile aynı) */
import { router, Stack } from 'expo-router';
import { Card, ListItem, Screen, Section, T, type IconName } from '@/components/ui';
import { useStaff } from '@/lib/auth';
import { space } from '@/theme';

interface Item {
  href: string;
  title: string;
  subtitle: string;
  icon: IconName;
}

export default function SettingsIndex() {
  const { can } = useStaff();
  const canBusiness = can('settings:write') && can('content:write');

  const groups: { title: string; items: Item[] }[] = [
    {
      title: 'Hesabım',
      items: [
        { href: '/panel/ayarlar/profil', title: 'Profil', subtitle: 'Ad, hitap ve giriş e-postası', icon: 'user' },
        { href: '/panel/ayarlar/guvenlik', title: 'Hesap & Güvenlik', subtitle: 'Şifre, uygulama kilidi ve aktif oturumlar', icon: 'lock' },
        { href: '/panel/ayarlar/bildirimler', title: 'Bildirim tercihleri', subtitle: 'Hangi olaylarda bildirim alacağınız', icon: 'bell' },
      ],
    },
    {
      title: 'İşletme',
      items: canBusiness
        ? [
            { href: '/panel/ayarlar/isletme', title: 'İşletme bilgileri', subtitle: 'Marka, unvan ve veri sorumlusu', icon: 'briefcase' },
            { href: '/panel/ayarlar/randevu', title: 'Randevu ayarları', subtitle: 'Talep aralığı, görüşme türleri ve form notu', icon: 'calendar' },
          ]
        : [],
    },
    {
      title: 'E-posta & WhatsApp',
      items: canBusiness
        ? [
            { href: '/panel/ayarlar/eposta', title: 'E-posta (SMTP)', subtitle: 'Giden e-posta sunucusu ve test iletisi', icon: 'mail' },
            { href: '/panel/ayarlar/hazir-mesajlar', title: 'Hazır WhatsApp mesajları', subtitle: '“WhatsApp’tan yaz” düğmesinin metinleri', icon: 'message-circle' },
            { href: '/panel/ayarlar/whatsapp', title: 'WhatsApp Business', subtitle: 'Otomatik mesajlar (Cloud API)', icon: 'send' },
          ]
        : [],
    },
    {
      title: 'Yönetim',
      items: [
        ...(canBusiness ? [{ href: '/panel/ayarlar/kvkk', title: 'KVKK & Gizlilik', subtitle: 'Hukuki inceleme, aydınlatma sürümü, saklama süresi', icon: 'shield' as IconName }] : []),
        ...(can('users:manage') ? [{ href: '/panel/ayarlar/kullanicilar', title: 'Kullanıcılar', subtitle: 'Panel kullanıcıları ve şifre bağlantıları', icon: 'users' as IconName }] : []),
        ...(can('audit:read') ? [{ href: '/panel/denetim', title: 'Denetim kayıtları', subtitle: 'Kim, ne zaman, hangi işlemi yaptı', icon: 'file-text' as IconName }] : []),
      ],
    },
  ];

  return (
    <>
      <Stack.Screen options={{ title: 'Ayarlar' }} />
      <Screen>
        <T muted style={{ marginBottom: space.xl }}>Hesabınızı, işletme bilgilerinizi ve randevu kurallarınızı yönetin.</T>
        {groups
          .filter((g) => g.items.length)
          .map((g) => (
            <Section key={g.title} title={g.title}>
              <Card padded={false}>
                {g.items.map((i, idx) => (
                  <ListItem key={i.href} title={i.title} subtitle={i.subtitle} icon={i.icon} onPress={() => router.push(i.href)} last={idx === g.items.length - 1} />
                ))}
              </Card>
            </Section>
          ))}
      </Screen>
    </>
  );
}
