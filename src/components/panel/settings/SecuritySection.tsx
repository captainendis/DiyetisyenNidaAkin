// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import { useState } from 'react';
import { Check, Laptop, Smartphone } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import { usePanelAuth } from '@/components/panel/PanelAuth';
import { Badge, Button, ErrorState, Input, SkeletonRows, useFeedback } from '@/components/panel/ui';
import { FormCard, FormSection } from '@/components/panel/content/FormBits';
import { cn, formatDateTime, relativeTime } from '@/lib/format';

interface SessionRow { id: string; createdAt: string; lastSeenAt: string; ip: string | null; userAgent: string | null; remember: boolean; current: boolean }

function describeAgent(ua: string | null) {
  if (!ua) return { label: 'Bilinmeyen cihaz', mobile: false };
  const mobile = /Mobile|Android|iPhone|iPad/i.test(ua);
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : /curl/i.test(ua) ? 'Komut satırı' : 'Tarayıcı';
  const os = /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) && !mobile ? 'macOS' : /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Linux/.test(ua) ? 'Linux' : '';
  return { label: [browser, os].filter(Boolean).join(' · '), mobile };
}

export function SecuritySection() {
  const fb = useFeedback();
  const { refresh } = usePanelAuth();
  const [f, setF] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const sessions = useApi(() => api.get<{ sessions: SessionRow[] }>('/settings/sessions'), []);

  const rules = [
    { ok: f.newPassword.length >= 10, label: 'En az 10 karakter' },
    { ok: /[A-Za-zÇĞİÖŞÜçğıöşü]/.test(f.newPassword), label: 'En az bir harf' },
    { ok: /\d/.test(f.newPassword), label: 'En az bir rakam' },
  ];

  const change = async () => {
    const local: Record<string, string> = {};
    if (!f.currentPassword) local.currentPassword = 'Mevcut şifrenizi girin';
    if (rules.some((r) => !r.ok)) local.newPassword = 'Şifre kurallarını karşılamıyor';
    if (f.newPassword !== f.confirm) local.confirm = 'Şifreler eşleşmiyor';
    if (Object.keys(local).length) return setErrors(local);
    setSaving(true);
    setErrors({});
    try {
      await api.post('/auth/change-password', { currentPassword: f.currentPassword, newPassword: f.newPassword });
      await refresh();
      setF({ currentPassword: '', newPassword: '', confirm: '' });
      fb.success('Şifreniz değiştirildi', 'Diğer cihazlardaki oturumlar kapatıldı.');
      void sessions.reload();
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) setErrors(e.fields);
      else fb.error('Şifre değiştirilemedi', e instanceof ApiError ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const revoke = async (s: SessionRow) => {
    if (!(await fb.confirm({ title: 'Oturumu kapat', description: 'Bu cihazdaki oturum sonlandırılacak; yeniden giriş yapılması gerekecek.', confirmLabel: 'Oturumu kapat', tone: 'danger' }))) return;
    try {
      await api.del(`/settings/sessions/${s.id}`);
      fb.success('Oturum kapatıldı');
      void sessions.reload();
    } catch (e) {
      fb.error('Oturum kapatılamadı', e instanceof ApiError ? e.message : undefined);
    }
  };

  return (
    <FormCard>
      <FormSection title="Şifre değiştir" description="Şifrenizi değiştirdiğinizde diğer tüm cihazlardaki oturumlar kapatılır.">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void change();
          }}
        >
          <Input label="Mevcut şifre" type="password" autoComplete="current-password" value={f.currentPassword} error={errors.currentPassword} onChange={(e) => setF({ ...f, currentPassword: e.target.value })} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Yeni şifre" type="password" autoComplete="new-password" value={f.newPassword} error={errors.newPassword} onChange={(e) => setF({ ...f, newPassword: e.target.value })} />
            <Input label="Yeni şifre (tekrar)" type="password" autoComplete="new-password" value={f.confirm} error={errors.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} />
          </div>
          <ul className="flex flex-wrap gap-x-5 gap-y-1 text-[0.78rem]" aria-label="Şifre kuralları">
            {rules.map((r) => (
              <li key={r.label} className={cn('flex items-center gap-1.5', r.ok ? 'text-success-ink' : 'text-panel-muted')}>
                <Check className={cn('h-3.5 w-3.5', !r.ok && 'opacity-30')} /> {r.label}
              </li>
            ))}
          </ul>
          <Button type="submit" loading={saving}>Şifreyi değiştir</Button>
        </form>
      </FormSection>
      <FormSection title="Aktif oturumlar" description="Hesabınızın açık olduğu cihazlar. Tanımadığınız bir oturum görürseniz kapatın ve şifrenizi değiştirin.">
        {sessions.loading && !sessions.data ? (
          <SkeletonRows rows={2} />
        ) : sessions.error ? (
          <ErrorState message={sessions.error.message} onRetry={sessions.reload} />
        ) : (
          <ul className="divide-y divide-panel-line rounded-lg border border-panel-line">
            {sessions.data!.sessions.map((s) => {
              const a = describeAgent(s.userAgent);
              const Icon = a.mobile ? Smartphone : Laptop;
              return (
                <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                  <Icon className="h-5 w-5 shrink-0 text-panel-muted" />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-espresso">
                      {a.label} {s.current && <Badge tone="success">Bu cihaz</Badge>}
                    </p>
                    <p className="text-[0.78rem] text-panel-muted" title={formatDateTime(s.lastSeenAt)}>
                      {s.ip ?? 'IP bilinmiyor'} · son etkinlik {relativeTime(s.lastSeenAt)} · giriş {formatDateTime(s.createdAt)}
                    </p>
                  </div>
                  {!s.current && (
                    <Button variant="secondary" size="sm" onClick={() => void revoke(s)}>Kapat</Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </FormSection>
    </FormCard>
  );
}
