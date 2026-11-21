// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Ayarlar → Hazır WhatsApp mesajları ("WhatsApp'tan yaz" metinleri) */
import { SettingsEditor } from '@/features/content/settingsStore';
import { WhatsappTemplatesForm } from '@/features/settings/ChannelsSections';
import { RequirePermission } from '@/features/settings/Gate';

export default function Route() {
  return (
    <RequirePermission perm={['settings:write', 'content:write']}>
      <SettingsEditor title="Hazır WhatsApp mesajları" keys={['whatsappTemplates']} successMessage="Hazır mesajlar kaydedildi" note="Bu metinler web sitesinde görünmez.">
        <WhatsappTemplatesForm />
      </SettingsEditor>
    </RequirePermission>
  );
}
