// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Ayarlar → İşletme bilgileri */
import { SettingsEditor } from '@/features/content/settingsStore';
import { BusinessForm } from '@/features/settings/BusinessSections';
import { RequirePermission } from '@/features/settings/Gate';

export default function Route() {
  return (
    <RequirePermission perm={['settings:write', 'content:write']}>
      <SettingsEditor title="İşletme bilgileri" keys={['business']} successMessage="İşletme bilgileri kaydedildi">
        <BusinessForm />
      </SettingsEditor>
    </RequirePermission>
  );
}
