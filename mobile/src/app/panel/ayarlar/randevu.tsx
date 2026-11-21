// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Ayarlar → Randevu ayarları */
import { SettingsEditor } from '@/features/content/settingsStore';
import { AppointmentForm, validateAppointment } from '@/features/settings/BusinessSections';
import { RequirePermission } from '@/features/settings/Gate';

export default function Route() {
  return (
    <RequirePermission perm={['settings:write', 'content:write']}>
      <SettingsEditor title="Randevu ayarları" keys={['appointment']} successMessage="Randevu ayarları kaydedildi" viewPath="/randevu" validate={validateAppointment}>
        <AppointmentForm />
      </SettingsEditor>
    </RequirePermission>
  );
}
