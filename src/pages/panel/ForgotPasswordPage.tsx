// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { api, ApiError } from '@/lib/api';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Button, Input } from '@/components/panel/ui';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ message: string; emailConfigured: boolean } | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const r = await api.post<{ ok: true; emailConfigured: boolean; message: string }>('/auth/forgot-password', { email });
      setDone(r);
    } catch (err) {
      setError(err instanceof ApiError ? (err.fields.email ?? err.message) : 'İstek gönderilemedi.');
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthLayout title="Şifremi unuttum" description="Hesabınıza kayıtlı e-posta adresini girin.">
      {done ? (
        <div className="space-y-6">
          <div className={`rounded-lg border px-4 py-4 text-sm leading-relaxed ${done.emailConfigured ? 'border-success/30 bg-success/10 text-[#3e5f47]' : 'border-warning/40 bg-warning/10 text-[#6d4c1e]'}`} role="status">
            {done.message}
          </div>
          <Link to="/panel/giris" className="inline-block text-sm font-medium text-cocoa underline-offset-4 hover:underline">← Girişe dön</Link>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-5">
          {error && <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-[#8a4545]" role="alert">{error}</div>}
          <Input label="E-posta" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          <Button type="submit" loading={pending} className="h-11 w-full">Sıfırlama bağlantısı iste</Button>
          <Link to="/panel/giris" className="block text-center text-sm text-panel-muted hover:text-cocoa">Girişe dön</Link>
        </form>
      )}
    </AuthLayout>
  );
}
