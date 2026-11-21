// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Ayarlar → KVKK & Gizlilik */
import { SettingsEditor } from '@/features/content/settingsStore';
import { PrivacyForm } from '@/features/settings/BusinessSections';
import { RequirePermission } from '@/features/settings/Gate';

export default function Route() {
  return (
    <RequirePermission perm={['settings:write', 'content:write']}>
      <SettingsEditor title="KVKK & Gizlilik" keys={['kvkk']} successMessage="KVKK ayarları kaydedildi" viewPath="/kvkk-aydinlatma-metni">
        <PrivacyForm />
      </SettingsEditor>
    </RequirePermission>
  );
}
