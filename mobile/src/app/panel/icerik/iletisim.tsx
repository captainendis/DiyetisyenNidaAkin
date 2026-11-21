// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Web sitesi içeriği → İletişim & Sosyal */
import { ContactForm, SocialForm } from '@/features/content/ContactForm';
import { SettingsEditor } from '@/features/content/settingsStore';
import { RequirePermission } from '@/features/settings/Gate';

export default function ContactContentScreen() {
  return (
    <RequirePermission perm="content:write">
      <SettingsEditor title="İletişim & Sosyal" keys={['contact', 'social']} viewPath="/iletisim" successMessage="İletişim bilgileri kaydedildi">
        <ContactForm />
        <SocialForm />
      </SettingsEditor>
    </RequirePermission>
  );
}
