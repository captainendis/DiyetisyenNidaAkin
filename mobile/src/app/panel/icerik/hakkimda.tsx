// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Web sitesi içeriği → Hakkımda */
import { AboutForm } from '@/features/content/AboutForm';
import { SettingsEditor } from '@/features/content/settingsStore';
import { RequirePermission } from '@/features/settings/Gate';

export default function AboutContentScreen() {
  return (
    <RequirePermission perm="content:write">
      <SettingsEditor title="Hakkımda" keys={['about']} viewPath="/hakkimda">
        <AboutForm />
      </SettingsEditor>
    </RequirePermission>
  );
}
