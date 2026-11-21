// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Web sitesi içeriği → SEO */
import { SeoForm } from '@/features/content/SeoForm';
import { SettingsEditor } from '@/features/content/settingsStore';
import { RequirePermission } from '@/features/settings/Gate';

export default function SeoContentScreen() {
  return (
    <RequirePermission perm="content:write">
      <SettingsEditor title="SEO" keys={['seo']} successMessage="SEO ayarları kaydedildi">
        <SeoForm />
      </SettingsEditor>
    </RequirePermission>
  );
}
