// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

'use client';

/** /hesabim/etkinlestir ve /hesabim/sifre-sifirla — bağlantıdaki token ile şifre belirleme; ardından oturum açılır */
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from '@/lib/router';
import { ApiError, portalApi } from '@/lib/api';
import { usePortalAuth } from '@/components/portal/PortalAuth';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Button, Input } from '@/components/panel/ui';
import { PORTAL_ASIDE } from './copy';

type Info = { purpose: 'ACTIVATE' | 'RESET'; firstName: string; email: string };

export default function PortalTokenPage({ mode }: { mode: 'activate' | 'reset' }) {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const { refresh } = usePortalAuth();
  const [info, setInfo] = useState<Info | null>(null);
  const [invalid, setInvalid] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    document.title = `${mode === 'activate' ? 'Hesabını etkinleştir' : 'Yeni şifre'} | Nida Akın`;
    // Token adres çubuğunda/geçmişte kalmasın
    if (token) window.history.replaceState(null, '', window.location.pathname);
    if (!token) return setInvalid('Bağlantı eksik. Sana gönderilen bağlantının tamamını açtığından emin ol.');
    portalApi
      .get<Info>('/auth/token', { token })
      .then(setInfo)
      .catch((e) => setInvalid(e instanceof ApiError ? e.message : 'Bağlantı doğrulanamadı.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setFields({});
    if (password !== confirm) return setFields({ confirm: 'Şifreler aynı değil' });
    setPending(true);
    try {
      await portalApi.post('/auth/set-password', { token, password });
      await refresh();
      navigate('/hesabim', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 422) setFields(err.fields);
        if (err.code === 'INVALID_TOKEN') setInvalid(err.message);
        else setError(err.message);
      } else setError('Şifre kaydedilemedi.');
    } finally {
      setPending(false);
    }
  };

  const activate = (info?.purpose ?? (mode === 'activate' ? 'ACTIVATE' : 'RESET')) === 'ACTIVATE';
  const title = activate ? 'Hesabını etkinleştir' : 'Yeni şifre belirle';

  return (
    <AuthLayout
      title={title}
      description={info ? <>Merhaba {info.firstName}. <span className="text-cocoa">{info.email}</span> için {activate ? 'bir şifre belirle; ardından hesabın açılır.' : 'yeni şifreni yaz.'}</> : undefined}
      aside={PORTAL_ASIDE}
    >
      {invalid ? (
        <div className="space-y-6">
          <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-4 text-sm leading-relaxed text-danger-ink" role="alert">{invalid}</div>
          <Link to="/hesabim/giris" className="text-sm font-semibold text-cocoa underline-offset-4 hover:underline">Giriş sayfasına git</Link>
        </div>
      ) : !info ? (
        <div className="h-40 animate-pulse rounded-xl bg-panel-line/50" aria-busy="true" />
      ) : (
        <form onSubmit={submit} noValidate className="space-y-5">
          {error && <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger-ink" role="alert">{error}</div>}
          <input type="email" autoComplete="username" value={info.email} readOnly hidden />
          <Input label="Şifre" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} error={fields.password} hint="En az 10 karakter; en az bir harf ve bir rakam." required autoFocus />
          <Input label="Şifre (tekrar)" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={fields.confirm} required />
          <Button type="submit" loading={pending} className="h-11 w-full">{activate ? 'Şifremi belirle ve giriş yap' : 'Şifremi değiştir ve giriş yap'}</Button>
        </form>
      )}
    </AuthLayout>
  );
}
