// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

'use client';

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
  // Hesap ve veri silme talebi: ilk düğme onay adımını açar; talep diyetisyene iletilir (en geç 30 gün)
  const [deletionAt, setDeletionAt] = useState<string | null>(me?.deletionRequestedAt ?? null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    setDeletionAt(me?.deletionRequestedAt ?? null);
  }, [me?.deletionRequestedAt]);

  const requestDeletion = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      const r = await portalApi.post<{ deletionRequestedAt: string }>('/account/deletion-request', {});
      setDeletionAt(r.deletionRequestedAt);
      setConfirmDelete(false);
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Talep gönderilemedi. Tekrar dene.');
    } finally {
      setDeleting(false);
    }
  };

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
      <Panel className="panel-root mt-6 max-w-xl">
        <PanelTitle>Hesabını sil</PanelTitle>
        {deletionAt ? (
          <p role="status" className="rounded-lg border border-info/30 bg-info/10 px-4 py-3 text-sm text-info-ink">
            Silme talebin {new Date(deletionAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })} tarihinde alındı. En geç 30 gün içinde sonuçlandırılır ve sana e-postayla bildirilir. Vazgeçersen diyetisyenine haber ver.
          </p>
        ) : (
          <div className="space-y-4 text-sm text-taupe">
            <p>
              Hesabının kapatılmasını ve ölçümlerin, beslenme listelerin, mesajların ve dosyaların dahil tüm verilerinin silinmesini isteyebilirsin. Talep en geç 30 gün içinde sonuçlandırılır. Yasal saklama yükümlülüğü olan kayıtlar varsa yalnızca o süre boyunca saklanır.
            </p>
            {deleteError && <div role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-danger-ink">{deleteError}</div>}
            {confirmDelete ? (
              <div className="space-y-3 rounded-lg border border-danger/30 p-4">
                <p className="font-semibold text-danger-ink">Talebini göndermek istediğine emin misin? Silme işlemi gerçekleştikten sonra geri alınamaz.</p>
                <div className="flex flex-wrap gap-3">
                  <PortalButton className="bg-danger-ink hover:bg-danger-ink/90" disabled={deleting} onClick={() => void requestDeletion()}>
                    {deleting ? 'Gönderiliyor…' : 'Talebi gönder'}
                  </PortalButton>
                  <PortalButton className="bg-transparent text-espresso ring-1 ring-espresso/20 hover:bg-sand" disabled={deleting} onClick={() => setConfirmDelete(false)}>
                    Vazgeç
                  </PortalButton>
                </div>
              </div>
            ) : (
              <PortalButton className="bg-transparent text-danger-ink ring-1 ring-danger/40 hover:bg-danger/10" onClick={() => setConfirmDelete(true)}>
                Hesabımın ve verilerimin silinmesini iste
              </PortalButton>
            )}
          </div>
        )}
      </Panel>
    </>
  );
}
