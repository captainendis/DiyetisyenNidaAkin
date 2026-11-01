// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import { usePanelAuth } from '@/components/panel/PanelAuth';
import { ErrorState, Input, Skeleton, useFeedback } from '@/components/panel/ui';
import { FormCard, FormSection, SaveBar } from '@/components/panel/content/FormBits';

interface Profile { email: string; firstName: string; lastName: string; salutation: string | null; role: { name: string } }

export function ProfileSection() {
  const fb = useFeedback();
  const { refresh } = usePanelAuth();
  const res = useApi(() => api.get<{ profile: Profile }>('/settings/profile'), []);
  const [f, setF] = useState({ firstName: '', lastName: '', salutation: '', email: '', currentPassword: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const p = res.data?.profile;
  const initial = p ? { firstName: p.firstName, lastName: p.lastName, salutation: p.salutation ?? '', email: p.email, currentPassword: '' } : null;
  useEffect(() => {
    if (initial) setF(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [res.data]);

  if (res.error) return <ErrorState message={res.error.message} onRetry={res.reload} />;
  if (!initial) return <Skeleton className="h-72 w-full rounded-xl" />;
  const dirty = JSON.stringify(f) !== JSON.stringify(initial);
  const emailChanged = f.email.trim().toLowerCase() !== initial.email;
  const set = (k: keyof typeof f, v: string) => (setF((x) => ({ ...x, [k]: v })), setErrors((e) => ({ ...e, [k]: '' })));

  const save = async () => {
    setSaving(true);
    setErrors({});
    try {
      await api.patch('/settings/profile', {
        firstName: f.firstName,
        lastName: f.lastName,
        salutation: f.salutation.trim() || null,
        email: f.email,
        ...(emailChanged ? { currentPassword: f.currentPassword } : {}),
      });
      fb.success('Profil güncellendi');
      await refresh();
      void res.reload();
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) setErrors(e.fields);
      else fb.error('Kaydedilemedi', e instanceof ApiError ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormCard>
      <FormSection title="Kişisel bilgiler" description={`Rolünüz: ${p!.role.name}`}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Ad" required value={f.firstName} error={errors.firstName} onChange={(e) => set('firstName', e.target.value)} />
          <Input label="Soyad" required value={f.lastName} error={errors.lastName} onChange={(e) => set('lastName', e.target.value)} />
        </div>
        <Input label="Panelde hitap" placeholder="Ör. Nida Hanım" hint="Genel bakış sayfasındaki karşılama mesajında kullanılır." value={f.salutation} maxLength={60} error={errors.salutation} onChange={(e) => set('salutation', e.target.value)} />
      </FormSection>
      <FormSection title="Giriş e-postası" description="Panele giriş ve şifre sıfırlama için kullanılır.">
        <Input label="E-posta" type="email" required autoComplete="email" value={f.email} error={errors.email} onChange={(e) => set('email', e.target.value)} />
        {emailChanged && (
          <Input label="Mevcut şifreniz" type="password" autoComplete="current-password" hint="Güvenliğiniz için e-posta değişikliğini şifrenizle onaylayın." value={f.currentPassword} error={errors.currentPassword} onChange={(e) => set('currentPassword', e.target.value)} />
        )}
      </FormSection>
      <SaveBar dirty={dirty} saving={saving} onSave={() => void save()} onReset={() => (setF(initial), setErrors({}))} />
    </FormCard>
  );
}
