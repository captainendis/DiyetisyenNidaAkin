// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Danışan hesabı (Hesabım) yönetimi — yalnızca "portal:manage" (yönetici).
 * Akış: hesap aç → tek kullanımlık etkinleştirme bağlantısı üretilir → panel bağlantıyı bir kez gösterir
 * (kopyala / WhatsApp ile gönder) → danışan şifresini kendisi belirler. Şifreyi personel hiçbir zaman görmez.
 */
import { useState } from 'react';
import { Copy, ExternalLink, KeyRound, Link2, MessageCircle } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import { formatDateTime } from '@/lib/format';
import { Badge, Button, Card, CardHeader, Input, SkeletonRows, useFeedback } from '@/components/panel/ui';
import type { PortalAccountInfo, PortalLinkResult } from '@shared/portal';
import type { Client } from './types';

type AccountRes = { account: PortalAccountInfo | null; suggestedEmail: string | null };

function waLink(phone: string, text: string) {
  const digits = phone.replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

function LinkBox({ link, client, onClose }: { link: PortalLinkResult; client: Client; onClose: () => void }) {
  const { success, error } = useFeedback();
  const activate = link.purpose === 'ACTIVATE';
  const message = activate
    ? `Merhaba ${client.firstName}, danışan hesabın açıldı. Beslenme listelerini, tariflerini ve randevularını buradan görebilirsin. Şifreni belirlemek için bağlantı (${formatDateTime(link.expiresAt)} tarihine kadar geçerli):\n${link.link}`
    : `Merhaba ${client.firstName}, şifreni yenilemek için bağlantı (${formatDateTime(link.expiresAt)} tarihine kadar geçerli):\n${link.link}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link.link);
      success('Bağlantı kopyalandı');
    } catch {
      error('Kopyalanamadı', 'Bağlantıyı seçip elle kopyalayın.');
    }
  };
  return (
    <div className="rounded-lg border border-success/30 bg-success/[0.07] p-4">
      <p className="text-sm font-semibold text-success-ink">{activate ? 'Etkinleştirme bağlantısı hazır' : 'Şifre sıfırlama bağlantısı hazır'}</p>
      <p className="mt-1 text-[0.8rem] leading-relaxed text-cocoa">
        Bu bağlantı yalnızca şimdi gösterilir, tek kullanımlıktır ve {formatDateTime(link.expiresAt)} tarihine kadar geçerlidir.
        {link.emailed ? ' Danışanın e-postasına da gönderildi.' : ' E-posta gönderimi kapalı; bağlantıyı danışana siz iletin.'}
      </p>
      <input readOnly value={link.link} onFocus={(e) => e.currentTarget.select()} aria-label="Bağlantı" className="mt-3 h-10 w-full rounded-lg border border-panel-line bg-white px-3 font-mono text-[0.75rem] text-espresso" />
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" icon={<Copy className="h-4 w-4" />} onClick={() => void copy()}>Kopyala</Button>
        <a href={waLink(client.phone, message)} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-white px-3 text-[0.8rem] font-semibold text-cocoa ring-1 ring-panel-line ring-inset hover:bg-panel-bg">
          <MessageCircle className="h-4 w-4" aria-hidden /> WhatsApp ile gönder
        </a>
        <Button size="sm" variant="ghost" onClick={onClose}>Kapat</Button>
      </div>
    </div>
  );
}

export function PortalAccountCard({ client }: { client: Client }) {
  const { data, error, loading, reload, setData } = useApi(() => api.get<AccountRes>(`/clients/${client.id}/account`), [client.id]);
  const [email, setEmail] = useState<string | null>(null);
  const [fieldErr, setFieldErr] = useState<string | undefined>();
  const [link, setLink] = useState<PortalLinkResult | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [editingEmail, setEditingEmail] = useState(false);
  const { success, error: toastError, confirm } = useFeedback();
  const acc = data?.account ?? null;
  const emailValue = email ?? (acc?.email || data?.suggestedEmail || '');

  async function run<T>(key: string, fn: () => Promise<T>, onOk: (r: T) => void) {
    setPending(key);
    setFieldErr(undefined);
    try {
      onOk(await fn());
    } catch (e) {
      if (e instanceof ApiError && e.fields.email) setFieldErr(e.fields.email);
      toastError('İşlem tamamlanamadı', (e as Error).message);
    } finally {
      setPending(null);
    }
  }

  const create = () =>
    run('create', () => api.post<{ account: PortalAccountInfo; link: PortalLinkResult }>(`/clients/${client.id}/account`, { email: emailValue }), (r) => {
      setData((d) => ({ suggestedEmail: d?.suggestedEmail ?? null, account: r.account }));
      setLink(r.link);
      setEmail(null);
      success('Danışan hesabı açıldı');
    });

  const newLink = () =>
    run('link', () => api.post<{ account: PortalAccountInfo; link: PortalLinkResult }>(`/clients/${client.id}/account/link`), (r) => {
      setData((d) => ({ suggestedEmail: d?.suggestedEmail ?? null, account: r.account }));
      setLink(r.link);
    });

  const patch = (key: string, body: { email?: string; isActive?: boolean }, msg: string) =>
    run(key, () => api.patch<{ account: PortalAccountInfo }>(`/clients/${client.id}/account`, body), (r) => {
      setData((d) => ({ suggestedEmail: d?.suggestedEmail ?? null, account: r.account }));
      setEditingEmail(false);
      setEmail(null);
      success(msg);
    });

  async function toggleActive() {
    if (!acc) return;
    if (acc.isActive) {
      const ok = await confirm({ title: 'Hesap kapatılsın mı?', description: 'Danışan giriş yapamaz ve açık oturumları hemen kapanır. Verileri silinmez; hesabı daha sonra yeniden açabilirsiniz.', confirmLabel: 'Hesabı kapat', tone: 'danger' });
      if (!ok) return;
    }
    await patch('active', { isActive: !acc.isActive }, acc.isActive ? 'Hesap kapatıldı' : 'Hesap yeniden açıldı');
  }

  async function remove() {
    const ok = await confirm({ title: 'Danışan hesabı silinsin mi?', description: 'Giriş bilgileri ve oturumlar silinir. Listeler, tarifler ve diğer kayıtlar etkilenmez. Yeniden hesap açmak gerekirse yeni bir bağlantı üretilir.', confirmLabel: 'Hesabı sil', tone: 'danger' });
    if (!ok) return;
    await run('delete', () => api.del(`/clients/${client.id}/account`), () => {
      setData((d) => ({ suggestedEmail: d?.suggestedEmail ?? null, account: null }));
      setLink(null);
      success('Danışan hesabı silindi');
    });
  }

  const status = !acc ? null : !acc.isActive ? (
    <Badge tone="danger">Kapalı</Badge>
  ) : acc.activated ? (
    <Badge tone="success">Etkin</Badge>
  ) : acc.pendingActivationUntil ? (
    <Badge tone="warning">Etkinleştirme bekleniyor</Badge>
  ) : (
    <Badge tone="danger">Bağlantının süresi doldu</Badge>
  );

  return (
    <Card>
      <CardHeader title="Danışan hesabı" description="Danışan listelerini, tariflerini, randevularını, ölçümlerini, mesajlarını ve paylaşılan dosyaları görür. Görüşme notlarını görmez." action={status} />
      <div className="space-y-4 px-5 pt-4 pb-5">
        {loading && !data ? (
          <SkeletonRows rows={2} />
        ) : error ? (
          <p className="text-sm text-danger-ink">{error.message} <button type="button" className="font-semibold underline" onClick={() => void reload()}>Tekrar dene</button></p>
        ) : !acc ? (
          <>
            {client.status === 'ARCHIVED' ? (
              <p className="text-sm text-panel-muted">Arşivlenmiş danışan için hesap açılamaz.</p>
            ) : (
              <>
                <Input label="Giriş e-postası" type="email" value={emailValue} onChange={(e) => setEmail(e.target.value)} error={fieldErr} hint="Danışan bu adresle giriş yapar." />
                <Button icon={<KeyRound className="h-4 w-4" />} loading={pending === 'create'} disabled={!emailValue} onClick={() => void create()}>Hesap aç ve bağlantı üret</Button>
              </>
            )}
          </>
        ) : (
          <>
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-panel-muted">E-posta</dt><dd className="min-w-0 truncate text-espresso">{acc.email}</dd></div>
              {acc.activatedAt && <div className="flex justify-between gap-3"><dt className="text-panel-muted">Etkinleştirildi</dt><dd className="tabular text-espresso">{formatDateTime(acc.activatedAt)}</dd></div>}
              <div className="flex justify-between gap-3"><dt className="text-panel-muted">Son giriş</dt><dd className="tabular text-espresso">{acc.lastLoginAt ? formatDateTime(acc.lastLoginAt) : 'Henüz yok'}</dd></div>
              {!acc.activated && acc.pendingActivationUntil && <div className="flex justify-between gap-3"><dt className="text-panel-muted">Bağlantı geçerli</dt><dd className="tabular text-espresso">{formatDateTime(acc.pendingActivationUntil)} tarihine kadar</dd></div>}
            </dl>

            {link && <LinkBox link={link} client={client} onClose={() => setLink(null)} />}

            {editingEmail && (
              <div className="space-y-2">
                <Input label="Yeni giriş e-postası" type="email" value={emailValue} onChange={(e) => setEmail(e.target.value)} error={fieldErr} />
                <div className="flex gap-2">
                  <Button size="sm" loading={pending === 'email'} onClick={() => void patch('email', { email: emailValue }, 'E-posta güncellendi')}>Kaydet</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setEditingEmail(false); setEmail(null); }}>Vazgeç</Button>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2 border-t border-panel-line pt-4">
              {acc.isActive && (
                <Button size="sm" icon={<Link2 className="h-4 w-4" />} loading={pending === 'link'} onClick={() => void newLink()}>
                  {acc.activated ? 'Şifre sıfırlama bağlantısı' : 'Yeni etkinleştirme bağlantısı'}
                </Button>
              )}
              {!editingEmail && <Button size="sm" variant="secondary" onClick={() => setEditingEmail(true)}>E-postayı değiştir</Button>}
              <Button size="sm" variant="secondary" loading={pending === 'active'} onClick={() => void toggleActive()}>{acc.isActive ? 'Hesabı kapat' : 'Hesabı aç'}</Button>
              <Button size="sm" variant="ghost" className="text-danger-ink hover:bg-danger/10" loading={pending === 'delete'} onClick={() => void remove()}>Sil</Button>
            </div>
            <a href="/hesabim/giris" target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 text-[0.8rem] font-medium text-panel-muted hover:text-cocoa">
              Danışan giriş sayfası <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
          </>
        )}
      </div>
    </Card>
  );
}
