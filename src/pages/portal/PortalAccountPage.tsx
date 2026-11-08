// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import { useEffect, useState, type FormEvent } from 'react';
import { ApiError, portalApi } from '@/lib/api';
import { usePortalAuth } from '@/components/portal/PortalAuth';
import { Panel, PanelTitle, PortalButton, PortalPageHeader } from '@/components/portal/ui';
import { Input } from '@/components/panel/ui';

export default function PortalAccountPage() {
  const { me, refresh } = usePortalAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    document.title = 'Hesap | Nida Akın';
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setFields({});
    if (next !== confirm) return setFields({ confirm: 'Şifreler aynı değil' });
    setPending(true);
    try {
      await portalApi.post('/auth/change-password', { currentPassword: current, newPassword: next });
      await refresh(); // yeni oturumun CSRF token'ı
      setCurrent('');
      setNext('');
      setConfirm('');
      setMsg({ ok: true, text: 'Şifren değiştirildi. Diğer cihazlardaki oturumların kapatıldı.' });
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setFields({ ...err.fields, ...(err.fields.newPassword ? { next: err.fields.newPassword } : {}), ...(err.fields.currentPassword ? { current: err.fields.currentPassword } : {}) });
      }
      setMsg({ ok: false, text: err instanceof ApiError ? err.message : 'Şifre değiştirilemedi.' });
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <PortalPageHeader title="Hesap" lead={<>Giriş e-postan: <b className="font-semibold">{me?.email}</b>. E-posta adresini değiştirmek için diyetisyeninle iletişime geç.</>} />
      <Panel className="panel-root max-w-xl">
        <PanelTitle>Şifreni değiştir</PanelTitle>
        <form onSubmit={submit} noValidate className="space-y-4">
          {msg && <div role={msg.ok ? 'status' : 'alert'} className={`rounded-lg border px-4 py-3 text-sm ${msg.ok ? 'border-success/30 bg-success/10 text-success-ink' : 'border-danger/30 bg-danger/10 text-danger-ink'}`}>{msg.text}</div>}
          <input type="email" autoComplete="username" value={me?.email ?? ''} readOnly hidden />
          <Input label="Mevcut şifre" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} error={fields.current} required />
          <Input label="Yeni şifre" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} error={fields.next} hint="En az 10 karakter; en az bir harf ve bir rakam." required />
          <Input label="Yeni şifre (tekrar)" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={fields.confirm} required />
          <PortalButton type="submit" disabled={pending}>{pending ? 'Kaydediliyor…' : 'Şifremi değiştir'}</PortalButton>
        </form>
      </Panel>
    </>
  );
}
