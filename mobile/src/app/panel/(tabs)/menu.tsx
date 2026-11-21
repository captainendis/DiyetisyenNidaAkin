// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Panel menüsü — web'deki yan menünün tamamı (PanelLayout.tsx) */
import { router, type Href } from 'expo-router';
import { View } from 'react-native';
import { useAppLock } from '@/components/AppLock';
import { useUnreadCount } from '@/components/nav';
import { Avatar, Badge, Card, confirm, ListItem, Notice, Screen, Section, SwitchField, T, type IconName } from '@/components/ui';
import { useAuth, useStaff, type Permission } from '@/lib/auth';
import { space } from '@/theme';
import { ROLE_LABEL } from '@shared/constants';

interface Item {
  href: Href;
  label: string;
  icon: IconName;
  perm?: Permission;
  badge?: number;
}

export default function PanelMenu() {
  const { user, demoMode, can } = useStaff();
  const { logout } = useAuth();
  const lock = useAppLock();
  const unread = useUnreadCount();

  const groups: { title: string; items: Item[] }[] = [
    {
      title: 'Günlük',
      items: [
        { href: '/panel/bildirimler', label: 'Bildirimler', icon: 'bell', badge: unread },
        { href: '/panel/pilates', label: 'Pilates', icon: 'activity', perm: 'appointments:read' },
        { href: '/panel/planlar', label: 'Beslenme Planları', icon: 'clipboard', perm: 'clinical:read' },
        { href: '/panel/tarifler', label: 'Tarifler', icon: 'book-open', perm: 'clinical:read' },
      ],
    },
    {
      title: 'İşletme',
      items: [
        { href: '/panel/raporlar', label: 'Raporlar', icon: 'bar-chart-2', perm: 'reports:read' },
        { href: '/panel/hizmetler', label: 'Hizmetler', icon: 'feather', perm: 'services:write' },
        { href: '/panel/icerik', label: 'Web Sitesi İçeriği', icon: 'layout', perm: 'content:write' },
        { href: '/panel/blog', label: 'Blog', icon: 'edit-3', perm: 'content:write' },
      ],
    },
    {
      title: 'Ayarlar',
      items: [
        { href: '/panel/takvim', label: 'Çalışma Takvimi', icon: 'clock', perm: 'availability:write' },
        { href: '/panel/ayarlar', label: 'Ayarlar', icon: 'settings' },
        { href: '/panel/denetim', label: 'Denetim Kaydı', icon: 'shield', perm: 'audit:read' },
      ],
    },
  ];

  return (
    <Screen>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.xl }}>
        <Avatar name={`${user.firstName} ${user.lastName}`} size={48} tone="dark" />
        <View style={{ flex: 1, gap: 2 }}>
          <T variant="heading">{user.salutation ? `${user.salutation} ` : ''}{user.firstName} {user.lastName}</T>
          <T variant="caption">{user.email}</T>
        </View>
        <Badge label={ROLE_LABEL[user.role]} tone="gold" />
      </Card>
      {demoMode ? <View style={{ marginBottom: space.xl }}><Notice tone="warning" title="Demo modu" text="Bu kurulumda örnek veriler gösteriliyor." /></View> : null}
      {groups.map((g) => {
        const items = g.items.filter((i) => !i.perm || can(i.perm));
        if (!items.length) return null;
        return (
          <Section key={g.title} title={g.title}>
            <Card padded={false}>
              {items.map((i, idx) => (
                <ListItem
                  key={i.label}
                  title={i.label}
                  icon={i.icon}
                  right={i.badge ? <Badge label={String(i.badge > 99 ? '99+' : i.badge)} tone="rose" /> : undefined}
                  onPress={() => router.push(i.href)}
                  last={idx === items.length - 1}
                />
              ))}
            </Card>
          </Section>
        );
      })}
      <Section title="Güvenlik">
        <Card>
          {lock.available ? (
            <SwitchField label="Face ID / parmak izi kilidi" help="Uygulama 2 dakikadan uzun arka planda kalırsa kilitlenir." value={lock.enabled} onChange={(v) => void lock.setEnabled(v)} />
          ) : (
            <T variant="caption">Bu cihazda biyometrik kilit kullanılamıyor.</T>
          )}
        </Card>
      </Section>
      <Card padded={false}>
        <ListItem
          title="Çıkış yap"
          icon="log-out"
          danger
          last
          onPress={async () => {
            if (await confirm({ title: 'Çıkış yapılsın mı?', confirmText: 'Çıkış yap', destructive: true })) await logout();
          }}
        />
      </Card>
    </Screen>
  );
}
