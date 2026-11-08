// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import { useSearchParams } from 'react-router';
import { RequirePermission } from '@/components/panel/PanelAuth';
import { ErrorState, PageHeader, Skeleton, Tabs } from '@/components/panel/ui';
import { SettingsStoreProvider, useSettingsStore } from '@/components/panel/content/settingsStore';
import { ApproachForm, CtaForm, HeroForm, IntroForm, ProcessForm, RecipesSectionForm } from '@/components/panel/content/HomeForms';
import { AboutForm } from '@/components/panel/content/AboutForm';
import { ContactForm, SocialForm } from '@/components/panel/content/ContactForm';
import { SeoForm } from '@/components/panel/content/SeoForm';
import { BlogList } from '@/components/panel/content/BlogList';
import { FaqManager } from '@/components/panel/content/FaqManager';
import { SiteImagesForm } from '@/components/panel/content/SiteImagesForm';
import type { SettingsKey } from '@shared/settings';

type Tab = 'ana-sayfa' | 'gorseller' | 'hakkimda' | 'iletisim' | 'blog' | 'sss' | 'seo';
const TAB_KEYS: Record<Tab, SettingsKey[]> = {
  'ana-sayfa': ['hero', 'intro', 'approach', 'process', 'recipesSection', 'cta'],
  gorseller: ['media'],
  hakkimda: ['about'],
  iletisim: ['contact', 'social'],
  blog: [],
  sss: [],
  seo: ['seo'],
};

function Body() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('sekme') as Tab) || 'ana-sayfa';
  const { loading, error, reload, settings, dirtyKeys } = useSettingsStore();
  const mark = (t: Tab, label: string) => (TAB_KEYS[t].some((k) => dirtyKeys.includes(k)) ? `${label} •` : label);

  const needsSettings = TAB_KEYS[tab].length > 0;
  return (
    <>
      <Tabs<Tab>
        className="mb-6"
        value={tab}
        onChange={(t) => setParams({ sekme: t }, { replace: true })}
        tabs={[
          { value: 'ana-sayfa', label: mark('ana-sayfa', 'Ana Sayfa') },
          { value: 'gorseller', label: mark('gorseller', 'Görseller') },
          { value: 'hakkimda', label: mark('hakkimda', 'Hakkımda') },
          { value: 'iletisim', label: mark('iletisim', 'İletişim & Sosyal') },
          { value: 'blog', label: 'Beslenme Rehberi' },
          { value: 'sss', label: 'SSS' },
          { value: 'seo', label: mark('seo', 'SEO') },
        ]}
      />
      {needsSettings && loading && !settings ? (
        <div className="space-y-4">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      ) : needsSettings && error && !settings ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : (
        <div className="space-y-6">
          {tab === 'ana-sayfa' && (
            <>
              <HeroForm />
              <IntroForm />
              <ApproachForm />
              <ProcessForm />
              <RecipesSectionForm />
              <CtaForm />
            </>
          )}
          {tab === 'gorseller' && <SiteImagesForm />}
          {tab === 'hakkimda' && <AboutForm />}
          {tab === 'iletisim' && (
            <>
              <ContactForm />
              <SocialForm />
            </>
          )}
          {tab === 'blog' && <BlogList />}
          {tab === 'sss' && <FaqManager />}
          {tab === 'seo' && <SeoForm />}
        </div>
      )}
    </>
  );
}

export default function ContentPage() {
  return (
    <RequirePermission perm="content:write">
      <SettingsStoreProvider>
        <PageHeader
          eyebrow="Web sitesi"
          title="İçerik yönetimi"
          description="Web sitesindeki metinleri, iletişim bilgilerini ve Beslenme Rehberi yazılarını buradan güncelleyin. Kaydettiğiniz değişiklikler sitede hemen görünür."
        />
        <Body />
      </SettingsStoreProvider>
    </RequirePermission>
  );
}
