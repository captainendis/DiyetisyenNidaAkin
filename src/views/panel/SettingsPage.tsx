// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

'use client';

import { useSearchParams } from '@/lib/router';
import { usePanelAuth } from '@/components/panel/PanelAuth';
import { ErrorState, PageHeader, Skeleton, Tabs } from '@/components/panel/ui';
import { SettingsStoreProvider, useSettingsStore } from '@/components/panel/content/settingsStore';
import { ProfileSection } from '@/components/panel/settings/ProfileSection';
import { SecuritySection } from '@/components/panel/settings/SecuritySection';
import { AppointmentSection, BusinessSection, PrivacySection } from '@/components/panel/settings/BusinessSections';
import { NotificationsSection } from '@/components/panel/settings/NotificationsSection';
import { UsersSection } from '@/components/panel/settings/UsersSection';

type Tab = 'profil' | 'guvenlik' | 'isletme' | 'randevu' | 'bildirimler' | 'kvkk' | 'kullanicilar';
const STORE_TABS: Tab[] = ['isletme', 'randevu', 'kvkk'];

function StoreGate({ children }: { children: React.ReactNode }) {
  const { settings, loading, error, reload } = useSettingsStore();
  if (loading && !settings) return <Skeleton className="h-80 w-full rounded-xl" />;
  if (error && !settings) return <ErrorState message={error.message} onRetry={reload} />;
  return <>{children}</>;
}

export default function SettingsPage() {
  const { can } = usePanelAuth();
  const [params, setParams] = useSearchParams();
  const canBusiness = can('settings:write') && can('content:write');
  const tabs: { value: Tab; label: string }[] = [
    { value: 'profil', label: 'Profil' },
    { value: 'guvenlik', label: 'Hesap & Güvenlik' },
    ...(canBusiness
      ? ([
          { value: 'isletme', label: 'İşletme Bilgileri' },
          { value: 'randevu', label: 'Randevu Ayarları' },
        ] as const)
      : []),
    { value: 'bildirimler', label: 'Bildirim Tercihleri' },
    ...(canBusiness ? ([{ value: 'kvkk', label: 'KVKK & Gizlilik' }] as const) : []),
    ...(can('users:manage') ? ([{ value: 'kullanicilar', label: 'Kullanıcılar' }] as const) : []),
  ];
  const requested = params.get('sekme') as Tab | null;
  const tab: Tab = tabs.some((t) => t.value === requested) ? requested! : 'profil';

  const body = (
    <>
      {tab === 'profil' && <ProfileSection />}
      {tab === 'guvenlik' && <SecuritySection />}
      {tab === 'isletme' && <BusinessSection />}
      {tab === 'randevu' && <AppointmentSection />}
      {tab === 'bildirimler' && <NotificationsSection />}
      {tab === 'kvkk' && <PrivacySection />}
      {tab === 'kullanicilar' && <UsersSection />}
    </>
  );

  return (
    <>
      <PageHeader eyebrow="Ayarlar" title="Ayarlar" description="Hesabınızı, işletme bilgilerinizi ve randevu kurallarınızı yönetin." />
      <Tabs<Tab> className="mb-6" value={tab} onChange={(t) => setParams({ sekme: t }, { replace: true })} tabs={tabs} />
      {STORE_TABS.includes(tab) ? (
        <SettingsStoreProvider>
          <StoreGate>{body}</StoreGate>
        </SettingsStoreProvider>
      ) : (
        body
      )}
    </>
  );
}
