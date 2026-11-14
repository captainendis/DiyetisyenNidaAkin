// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Link } from '@/lib/router';
import { ApiError, portalApi } from '@/lib/api';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Button, Input } from '@/components/panel/ui';
import { PORTAL_ASIDE } from './copy';

export default function PortalForgotPage() {
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<{ message: string; emailConfigured: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();

  useEffect(() => {
    document.title = 'Şifremi unuttum | Nida Akın';
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldError(undefined);
    if (!email) return setFieldError('E-posta adresini gir');
    setPending(true);
    try {
      setDone(await portalApi.post<{ message: string; emailConfigured: boolean }>('/auth/forgot-password', { email }));
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) setFieldError(err.fields.email);
      setError(err instanceof ApiError ? err.message : 'İstek gönderilemedi.');
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthLayout title="Şifremi unuttum" description="Hesabına kayıtlı e-posta adresini yaz." aside={PORTAL_ASIDE}>
      {done ? (
        <div className="space-y-6">
          <div className={`rounded-lg border px-4 py-4 text-sm leading-relaxed ${done.emailConfigured ? 'border-success/30 bg-success/10 text-success-ink' : 'border-warning/35 bg-warning/10 text-warning-ink'}`} role="status">
            {done.message}
          </div>
          <Link to="/hesabim/giris" className="text-sm font-semibold text-cocoa underline-offset-4 hover:underline">← Girişe dön</Link>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-5">
          {error && <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger-ink" role="alert">{error}</div>}
          <Input label="E-posta" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} error={fieldError} required autoFocus />
          <Button type="submit" loading={pending} className="h-11 w-full">Sıfırlama bağlantısı iste</Button>
          <Link to="/hesabim/giris" className="block text-sm font-medium text-cocoa underline-offset-4 hover:underline">← Girişe dön</Link>
        </form>
      )}
    </AuthLayout>
  );
}
