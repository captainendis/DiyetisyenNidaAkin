// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Web sitesi içeriği → Görseller (kapak, görüşme alanı, portre) */
import { SettingsEditor } from '@/features/content/settingsStore';
import { SiteImagesForm } from '@/features/content/SiteImagesForm';
import { RequirePermission } from '@/features/settings/Gate';

export default function SiteImagesScreen() {
  return (
    <RequirePermission perm="content:write">
      <SettingsEditor title="Görseller" keys={['media']} viewPath="/" successMessage="Görseller kaydedildi">
        <SiteImagesForm />
      </SettingsEditor>
    </RequirePermission>
  );
}
