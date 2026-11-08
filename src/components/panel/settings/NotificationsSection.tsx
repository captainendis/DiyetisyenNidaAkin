// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import { ErrorState, Skeleton, Switch, useFeedback } from '@/components/panel/ui';
import { FormCard, FormSection, Notice, SaveBar } from '@/components/panel/content/FormBits';
import { NOTIFICATION_TYPE_LABEL, NOTIFICATION_TYPES } from '@shared/constants';

interface Prefs { inApp: Record<string, boolean>; email: Record<string, boolean> }
interface Res { prefs: Prefs; channels: { key: 'EMAIL' | 'WHATSAPP'; configured: boolean }[] }

export function NotificationsSection() {
  const fb = useFeedback();
  const res = useApi(() => api.get<Res>('/settings/notification-prefs'), []);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (res.data) setPrefs(res.data.prefs);
  }, [res.data]);

  if (res.error) return <ErrorState message={res.error.message} onRetry={res.reload} />;
  if (!prefs || !res.data) return <Skeleton className="h-72 w-full rounded-xl" />;
  const emailOn = res.data.channels.find((c) => c.key === 'EMAIL')?.configured ?? false;
  const waOn = res.data.channels.find((c) => c.key === 'WHATSAPP')?.configured ?? false;
  const dirty = JSON.stringify(prefs) !== JSON.stringify(res.data.prefs);

  const save = async () => {
    setSaving(true);
    try {
      await api.patch('/settings/notification-prefs', prefs);
      fb.success('Bildirim tercihleri kaydedildi');
      void res.reload();
    } catch (e) {
      fb.error('Kaydedilemedi', e instanceof ApiError ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormCard>
      <FormSection title="Bildirim kanalları" description="Panel içi bildirimler her zaman kullanılabilir. Harici kanallar sunucuda yapılandırıldığında etkinleşir.">
        <ul className="space-y-2 text-sm">
          <li className="flex items-center justify-between rounded-lg border border-panel-line px-4 py-3">
            <span className="font-medium text-espresso">Panel içi</span>
            <span className="text-[0.8rem] font-semibold text-success-ink">Etkin</span>
          </li>
          <li className="flex items-center justify-between rounded-lg border border-panel-line px-4 py-3">
            <span className="font-medium text-espresso">E-posta</span>
            <span className={emailOn ? 'text-[0.8rem] font-semibold text-success-ink' : 'text-[0.8rem] text-panel-muted'}>{emailOn ? 'Yapılandırıldı' : 'Yapılandırılmadı'}</span>
          </li>
          <li className="flex items-center justify-between rounded-lg border border-panel-line px-4 py-3">
            <span className="font-medium text-espresso">WhatsApp</span>
            <span className={waOn ? 'text-[0.8rem] font-semibold text-success-ink' : 'text-[0.8rem] text-panel-muted'}>{waOn ? 'Yapılandırıldı' : 'Entegrasyon henüz yok'}</span>
          </li>
        </ul>
        {!emailOn && (
          <Notice>
            E-posta gönderimi için sunucuda SMTP ayarlarının (README → “E-posta”) yapılması gerekir. Yapılandırılmadığı sürece hiçbir e-posta gönderilmez; tercihler kaydedilir ve kanal etkinleştiğinde uygulanır.
          </Notice>
        )}
      </FormSection>
      <FormSection title="Bildirim türleri" description="Hangi olaylarda bildirim almak istediğinizi seçin.">
        <div className="overflow-hidden rounded-lg border border-panel-line">
          <div className="grid grid-cols-[1fr_4.5rem_4.5rem] gap-2 border-b border-panel-line bg-panel-bg/60 px-4 py-2 text-[0.7rem] font-semibold tracking-wide text-panel-muted uppercase">
            <span>Olay</span>
            <span className="text-center">Panel</span>
            <span className="text-center">E-posta</span>
          </div>
          {NOTIFICATION_TYPES.map((t) => (
            <div key={t} className="grid grid-cols-[1fr_4.5rem_4.5rem] items-center gap-2 border-b border-panel-line px-4 py-3 last:border-0">
              <span className="text-sm text-espresso">{NOTIFICATION_TYPE_LABEL[t]}</span>
              <div className="flex justify-center">
                <Switch checked={prefs.inApp[t] !== false} onChange={(v) => setPrefs({ ...prefs, inApp: { ...prefs.inApp, [t]: v } })} label={<span className="sr-only">{NOTIFICATION_TYPE_LABEL[t]} — panel</span>} />
              </div>
              <div className="flex justify-center" title={emailOn ? undefined : 'E-posta kanalı yapılandırılmadı'}>
                <Switch disabled={!emailOn} checked={emailOn && prefs.email[t] === true} onChange={(v) => setPrefs({ ...prefs, email: { ...prefs.email, [t]: v } })} label={<span className="sr-only">{NOTIFICATION_TYPE_LABEL[t]} — e-posta</span>} />
              </div>
            </div>
          ))}
        </div>
      </FormSection>
      <SaveBar dirty={dirty} saving={saving} onSave={() => void save()} onReset={() => setPrefs(res.data!.prefs)} />
    </FormCard>
  );
}
