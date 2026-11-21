// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Web sitesi içeriği — bölümler (web: ContentPage sekmeleri) */
import { router, Stack } from 'expo-router';
import { Card, ListItem, Screen, Section, T, type IconName } from '@/components/ui';
import { ViewOnSiteButton } from '@/features/content/FormBits';
import { RequirePermission } from '@/features/settings/Gate';
import { space } from '@/theme';

const SECTIONS: { href: string; title: string; subtitle: string; icon: IconName }[] = [
  { href: '/panel/icerik/ana-sayfa', title: 'Ana sayfa', subtitle: 'Karşılama alanı, tanıtım, yaklaşım, süreç, tarifler ve randevu çağrısı', icon: 'home' },
  { href: '/panel/icerik/gorseller', title: 'Görseller', subtitle: 'Kapak fotoğrafı, görüşme alanı ve portre', icon: 'image' },
  { href: '/panel/icerik/hakkimda', title: 'Hakkımda', subtitle: 'Giriş, metin, yaklaşım ilkeleri, eğitim ve belgeler', icon: 'user' },
  { href: '/panel/icerik/iletisim', title: 'İletişim & Sosyal', subtitle: 'Telefon, WhatsApp, adres, harita ve sosyal medya', icon: 'phone' },
  { href: '/panel/icerik/sss', title: 'SSS', subtitle: 'Sık sorulan sorular, yayın durumu ve sıralama', icon: 'help-circle' },
  { href: '/panel/icerik/seo', title: 'SEO', subtitle: 'Arama motoru başlığı ve açıklaması', icon: 'search' },
];

export default function ContentIndex() {
  return (
    <>
      <Stack.Screen options={{ title: 'Web sitesi içeriği', headerRight: () => <ViewOnSiteButton path="/" /> }} />
      <RequirePermission perm="content:write">
        <Screen>
          <T muted style={{ marginBottom: space.xl }}>
            Web sitesindeki metinleri, iletişim bilgilerini ve Beslenme Rehberi yazılarını buradan güncelleyin. Kaydettiğiniz değişiklikler sitede hemen görünür.
          </T>
          <Section title="Sayfalar">
            <Card padded={false}>
              {SECTIONS.map((s, i) => (
                <ListItem key={s.href} title={s.title} subtitle={s.subtitle} icon={s.icon} onPress={() => router.push(s.href)} last={i === SECTIONS.length - 1} />
              ))}
            </Card>
          </Section>
          <Section title="Beslenme Rehberi">
            <Card padded={false}>
              <ListItem title="Blog yazıları" subtitle="Yazı ekleyin, düzenleyin, yayınlayın" icon="edit-3" onPress={() => router.push('/panel/blog')} last />
            </Card>
          </Section>
        </Screen>
      </RequirePermission>
    </>
  );
}
