// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Profil: ad, soyad, hitap, giriş e-postası (web: settings/ProfileSection.tsx) */
import { useState } from 'react';
import { QueryView, Screen, TextField, useToast } from '@/components/ui';
import { api, ApiError, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApiQuery } from '@/lib/query';
import { FormSection, SaveBar, useUnsavedGuard } from '../content/FormBits';

interface Profile {
  email: string;
  firstName: string;
  lastName: string;
  salutation: string | null;
  role: { name: string };
}

export function ProfileSection() {
  const q = useApiQuery(['settings', 'profile'], () => api.get<{ profile: Profile }>('/settings/profile'));
  return <QueryView query={q}>{(data) => <ProfileForm key={JSON.stringify(data.profile)} profile={data.profile} onSaved={() => void q.refetch()} />}</QueryView>;
}

function ProfileForm({ profile: p, onSaved }: { profile: Profile; onSaved: () => void }) {
  const toast = useToast();
  const { refresh } = useAuth();
  const initial = { firstName: p.firstName, lastName: p.lastName, salutation: p.salutation ?? '', email: p.email, currentPassword: '' };
  const [f, setF] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(f) !== JSON.stringify(initial);
  const emailChanged = f.email.trim().toLowerCase() !== initial.email;
  useUnsavedGuard(dirty && !saving);
  const set = (k: keyof typeof f, v: string) => {
    setF((x) => ({ ...x, [k]: v }));
    setErrors((e) => (e[k] ? { ...e, [k]: '' } : e));
  };

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
      toast('Profil güncellendi');
      await refresh().catch(() => {});
      onSaved();
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        setErrors(e.fields);
        toast(e.message, 'error');
      } else toast(`Kaydedilemedi: ${errorMessage(e)}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      footer={
        <SaveBar
          dirty={dirty}
          saving={saving}
          onSave={() => void save()}
          onReset={() => {
            setF(initial);
            setErrors({});
          }}
        />
      }
    >
      <FormSection title="Kişisel bilgiler" description={`Rolünüz: ${p.role.name}`}>
        <TextField label="Ad" required value={f.firstName} error={errors.firstName} autoComplete="given-name" onChange={(v) => set('firstName', v)} />
        <TextField label="Soyad" required value={f.lastName} error={errors.lastName} autoComplete="family-name" onChange={(v) => set('lastName', v)} />
        <TextField label="Panelde hitap" placeholder="Ör. Nida Hanım" help="Genel bakış sayfasındaki karşılama mesajında kullanılır." value={f.salutation} maxLength={60} error={errors.salutation} onChange={(v) => set('salutation', v)} />
      </FormSection>
      <FormSection title="Giriş e-postası" description="Panele giriş ve şifre sıfırlama için kullanılır.">
        <TextField label="E-posta" required keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" value={f.email} error={errors.email} onChange={(v) => set('email', v)} />
        {emailChanged ? (
          <TextField
            label="Mevcut şifreniz"
            secureTextEntry
            autoComplete="current-password"
            help="Güvenliğiniz için e-posta değişikliğini şifrenizle onaylayın."
            value={f.currentPassword}
            error={errors.currentPassword}
            onChange={(v) => set('currentPassword', v)}
          />
        ) : null}
      </FormSection>
    </Screen>
  );
}
