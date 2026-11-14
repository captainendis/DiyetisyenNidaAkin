// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from '@/lib/router';
import { Eye, EyeOff } from 'lucide-react';
import { ApiError, portalApi } from '@/lib/api';
import { safePortalNext, usePortalAuth } from '@/components/portal/PortalAuth';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Button, Checkbox, Input } from '@/components/panel/ui';
import { PORTAL_ASIDE } from './copy';

export default function PortalLoginPage() {
  const { me, loading, refresh } = usePortalAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = safePortalNext(params.get('next'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [show, setShow] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  useEffect(() => {
    document.title = 'Danışan girişi | Nida Akın';
  }, []);
  useEffect(() => {
    if (!loading && me) navigate(next, { replace: true });
  }, [loading, me, next, navigate]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setFields({});
    if (!email || !password) {
      setFields({ ...(email ? {} : { email: 'E-posta adresini gir' }), ...(password ? {} : { password: 'Şifreni gir' }) });
      return;
    }
    setPending(true);
    try {
      await portalApi.post('/auth/login', { email, password, remember });
      await refresh();
      navigate(next, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 422) setFields(err.fields);
        setError(err.message);
      } else setError('Giriş yapılamadı. Lütfen tekrar dene.');
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthLayout title="Danışan girişi" description="Diyetisyeninin açtığı hesapla giriş yap." aside={PORTAL_ASIDE}>
      <form onSubmit={submit} noValidate className="space-y-5">
        {error && <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger-ink" role="alert">{error}</div>}
        <Input label="E-posta" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} error={fields.email} required autoFocus />
        <div className="relative">
          <Input label="Şifre" type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={fields.password} required className="pr-11" />
          <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Şifreyi gizle' : 'Şifreyi göster'} className="absolute top-[30px] right-1.5 rounded-md p-2 text-panel-muted hover:text-cocoa">
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <div className="flex items-center justify-between gap-4">
          <Checkbox label="Beni hatırla" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          <Link to="/hesabim/sifremi-unuttum" className="text-sm font-medium text-cocoa underline-offset-4 hover:underline">Şifremi unuttum</Link>
        </div>
        <Button type="submit" loading={pending} className="h-11 w-full">Giriş yap</Button>
        <p className="text-[0.82rem] leading-relaxed text-panel-muted">
          Henüz hesabın yok mu? Hesaplar görüşmede diyetisyen tarafından açılır; sana bir etkinleştirme bağlantısı gönderilir.
        </p>
      </form>
    </AuthLayout>
  );
}
