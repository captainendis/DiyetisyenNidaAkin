// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Eye, EyeOff } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { usePanelAuth } from '@/components/panel/PanelAuth';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Button, Checkbox, Input } from '@/components/panel/ui';

function safeNext(v: string | null) {
  return v && v.startsWith('/panel') && !v.startsWith('//') && !v.startsWith('/panel/giris') ? v : '/panel';
}

export default function LoginPage() {
  const { user, loading, refresh } = usePanelAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = safeNext(params.get('next'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [show, setShow] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  useEffect(() => {
    document.title = 'Giriş | Nida Akın Panel';
  }, []);
  useEffect(() => {
    if (!loading && user) navigate(next, { replace: true });
  }, [loading, user, next, navigate]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setFields({});
    if (!email || !password) {
      setFields({ ...(email ? {} : { email: 'E-posta adresinizi girin' }), ...(password ? {} : { password: 'Şifrenizi girin' }) });
      return;
    }
    setPending(true);
    try {
      await api.post('/auth/login', { email, password, remember });
      await refresh();
      navigate(next, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 422) setFields(err.fields);
        setError(err.message);
      } else setError('Giriş yapılamadı. Lütfen tekrar deneyin.');
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthLayout title="Panele giriş" description="Hesap bilgilerinizle oturum açın.">
      <form onSubmit={submit} noValidate className="space-y-5">
        {error && <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-[#8a4545]" role="alert">{error}</div>}
        <Input label="E-posta" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} error={fields.email} required autoFocus />
        <div className="relative">
          <Input label="Şifre" type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={fields.password} required className="pr-11" />
          <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Şifreyi gizle' : 'Şifreyi göster'} className="absolute top-[30px] right-1.5 rounded-md p-2 text-panel-muted hover:text-cocoa">
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <div className="flex items-center justify-between gap-4">
          <Checkbox label="Beni hatırla" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          <Link to="/panel/sifremi-unuttum" className="text-sm font-medium text-cocoa underline-offset-4 hover:underline">Şifremi unuttum</Link>
        </div>
        <Button type="submit" loading={pending} className="h-11 w-full">Giriş yap</Button>
        <p className="text-[0.78rem] leading-relaxed text-panel-muted">Paylaşılan bilgisayarlarda "Beni hatırla" seçeneğini işaretlemeyin.</p>
      </form>
    </AuthLayout>
  );
}
