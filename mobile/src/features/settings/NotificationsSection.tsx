// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Bildirim tercihleri: panel içi / e-posta, olay bazında (web: settings/NotificationsSection.tsx) */
import { useState } from 'react';
import { Switch, View } from 'react-native';
import { Card, KeyValue, Notice, QueryView, Screen, T, useToast } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useApiQuery } from '@/lib/query';
import { colors, space } from '@/theme';
import { NOTIFICATION_TYPE_LABEL, NOTIFICATION_TYPES } from '@shared/constants';
import { FormSection, SaveBar, useUnsavedGuard } from '../content/FormBits';

interface Prefs {
  inApp: Record<string, boolean>;
  email: Record<string, boolean>;
}
interface Res {
  prefs: Prefs;
  channels: { key: 'EMAIL' | 'WHATSAPP'; configured: boolean }[];
}

export function NotificationsSection() {
  const q = useApiQuery(['settings', 'notification-prefs'], () => api.get<Res>('/settings/notification-prefs'));
  return <QueryView query={q}>{(data) => <PrefsForm key={JSON.stringify(data.prefs)} data={data} reload={() => void q.refetch()} />}</QueryView>;
}

function Status({ on }: { on: boolean }) {
  return (
    <T variant="label" color={on ? colors.successInk : colors.muted} weight={on ? 'semibold' : 'regular'}>
      {on ? 'Yapılandırıldı' : 'Yapılandırılmadı'}
    </T>
  );
}

function PrefsForm({ data, reload }: { data: Res; reload: () => void }) {
  const toast = useToast();
  const [prefs, setPrefs] = useState<Prefs>(data.prefs);
  const [saving, setSaving] = useState(false);
  const emailOn = data.channels.find((c) => c.key === 'EMAIL')?.configured ?? false;
  const waOn = data.channels.find((c) => c.key === 'WHATSAPP')?.configured ?? false;
  const dirty = JSON.stringify(prefs) !== JSON.stringify(data.prefs);
  useUnsavedGuard(dirty && !saving);

  const save = async () => {
    setSaving(true);
    try {
      await api.patch('/settings/notification-prefs', prefs);
      toast('Bildirim tercihleri kaydedildi');
      reload();
    } catch (e) {
      toast(`Kaydedilemedi: ${errorMessage(e)}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const sw = (label: string, value: boolean, onChange: (v: boolean) => void, disabled?: boolean) => (
    <View style={{ alignItems: 'center', gap: 2, width: 64 }}>
      <Switch value={value} onValueChange={onChange} disabled={disabled} accessibilityLabel={label} trackColor={{ true: colors.gold, false: colors.line }} />
    </View>
  );

  return (
    <Screen footer={<SaveBar dirty={dirty} saving={saving} onSave={() => void save()} onReset={() => setPrefs(data.prefs)} />}>
      <FormSection title="Bildirim kanalları" description="Panel içi bildirimler her zaman açıktır.">
        <View>
          <KeyValue label="Panel içi" value={<T variant="label" color={colors.successInk}>Etkin</T>} />
          <KeyValue label="E-posta" value={<Status on={emailOn} />} />
          <KeyValue label="WhatsApp" value={<Status on={waOn} />} last />
        </View>
        {!emailOn ? (
          <Notice text="E-posta kanalı henüz açık değil. Tercihleriniz kaydedilir ve kanal açıldığında uygulanır. SMTP bilgilerini “E-posta (SMTP)” ayarından girebilirsiniz." />
        ) : null}
      </FormSection>
      <FormSection title="Bildirim türleri" description="Hangi olaylarda bildirim almak istediğinizi seçin.">
        <Card padded={false} style={{ shadowOpacity: 0, elevation: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: colors.bg }}>
            <T variant="overline" color={colors.muted} style={{ flex: 1 }}>Olay</T>
            <T variant="overline" color={colors.muted} style={{ width: 64, textAlign: 'center' }}>Panel</T>
            <T variant="overline" color={colors.muted} style={{ width: 64, textAlign: 'center' }}>E-posta</T>
          </View>
          {NOTIFICATION_TYPES.map((t, i) => (
            <View key={t} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, paddingVertical: 10, borderBottomWidth: i < NOTIFICATION_TYPES.length - 1 ? 1 : 0, borderBottomColor: colors.line }}>
              <T style={{ flex: 1 }}>{NOTIFICATION_TYPE_LABEL[t]}</T>
              {sw(`${NOTIFICATION_TYPE_LABEL[t]} — panel`, prefs.inApp[t] !== false, (v) => setPrefs({ ...prefs, inApp: { ...prefs.inApp, [t]: v } }))}
              {sw(`${NOTIFICATION_TYPE_LABEL[t]} — e-posta`, emailOn && prefs.email[t] === true, (v) => setPrefs({ ...prefs, email: { ...prefs.email, [t]: v } }), !emailOn)}
            </View>
          ))}
        </Card>
      </FormSection>
    </Screen>
  );
}
