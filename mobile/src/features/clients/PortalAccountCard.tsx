// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Danışan hesabı (Hesabım) yönetimi — yalnızca "portal:manage" (yönetici).
 * Hesap aç → tek kullanımlık etkinleştirme bağlantısı bir kez gösterilir (kopyala / paylaş / WhatsApp) →
 * danışan şifresini kendisi belirler. Şifreyi personel hiçbir zaman görmez.
 */
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Linking, Share, View } from 'react-native';
import { Badge, Button, Card, KeyValue, Loading, Notice, T, TextField, confirm, useToast } from '@/components/ui';
import { api, ApiError, errorMessage } from '@/lib/api';
import { API_URL } from '@/lib/config';
import { formatDateTime } from '@/lib/format';
import { queryClient, useApiQuery } from '@/lib/query';
import type { PortalAccountInfo, PortalLinkResult } from '@shared/portal';
import { colors, radius, space } from '@/theme';
import { CardTitle } from './common';
import { clientKeys, type Client } from './types';

type AccountRes = { account: PortalAccountInfo | null; suggestedEmail: string | null };

function LinkBox({ link, client, onClose }: { link: PortalLinkResult; client: Client; onClose: () => void }) {
  const toast = useToast();
  const activate = link.purpose === 'ACTIVATE';
  const message = activate
    ? `Merhaba ${client.firstName}, danışan hesabın açıldı. Beslenme listelerini, tariflerini ve randevularını buradan görebilirsin. Şifreni belirlemek için bağlantı (${formatDateTime(link.expiresAt)} tarihine kadar geçerli):\n${link.link}`
    : `Merhaba ${client.firstName}, şifreni yenilemek için bağlantı (${formatDateTime(link.expiresAt)} tarihine kadar geçerli):\n${link.link}`;

  const copy = async () => {
    try {
      await Clipboard.setStringAsync(link.link);
      toast('Bağlantı kopyalandı');
    } catch {
      toast('Kopyalanamadı', 'error');
    }
  };
  const whatsapp = async () => {
    const url = `https://wa.me/${client.phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
    try {
      await Linking.openURL(url);
    } catch {
      toast('WhatsApp açılamadı', 'error');
    }
  };

  return (
    <View style={{ backgroundColor: colors.successBg, borderRadius: radius.md, padding: space.md, gap: space.sm }}>
      <T variant="label" color={colors.successInk}>{activate ? 'Etkinleştirme bağlantısı hazır' : 'Şifre sıfırlama bağlantısı hazır'}</T>
      <T variant="caption" color={colors.text}>
        Bu bağlantı yalnızca şimdi gösterilir, tek kullanımlıktır ve {formatDateTime(link.expiresAt)} tarihine kadar geçerlidir.
        {link.emailed ? ' Danışanın e-postasına da gönderildi.' : ' E-posta gönderimi kapalı; bağlantıyı danışana siz iletin.'}
      </T>
      <View style={{ backgroundColor: colors.surface, borderRadius: radius.sm, padding: space.sm, borderWidth: 1, borderColor: colors.line }}>
        <T variant="caption" color={colors.text} selectable>{link.link}</T>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        <Button title="Kopyala" icon="copy" size="sm" onPress={() => void copy()} />
        <Button title="Paylaş" icon="share" size="sm" variant="secondary" onPress={() => void Share.share({ message })} />
        <Button title="WhatsApp ile gönder" icon="message-circle" size="sm" variant="secondary" onPress={() => void whatsapp()} />
        <Button title="Kapat" size="sm" variant="ghost" onPress={onClose} />
      </View>
    </View>
  );
}

export function PortalAccountCard({ client }: { client: Client }) {
  const key = clientKeys.sub(client.id, 'account');
  const q = useApiQuery(key, () => api.get<AccountRes>(`/clients/${client.id}/account`));
  const [email, setEmail] = useState<string | null>(null);
  const [fieldErr, setFieldErr] = useState<string | undefined>();
  const [link, setLink] = useState<PortalLinkResult | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [editingEmail, setEditingEmail] = useState(false);
  const toast = useToast();
  const acc = q.data?.account ?? null;
  const emailValue = email ?? (acc?.email || q.data?.suggestedEmail || '');
  const setAccount = (account: PortalAccountInfo | null) =>
    queryClient.setQueryData<AccountRes>(key, (d) => ({ suggestedEmail: d?.suggestedEmail ?? null, account }));

  async function run<R>(k: string, fn: () => Promise<R>, onOk: (r: R) => void) {
    setPending(k);
    setFieldErr(undefined);
    try {
      onOk(await fn());
    } catch (e) {
      if (e instanceof ApiError && e.fields.email) setFieldErr(e.fields.email);
      toast(errorMessage(e), 'error');
    } finally {
      setPending(null);
    }
  }

  const create = () =>
    run('create', () => api.post<{ account: PortalAccountInfo; link: PortalLinkResult }>(`/clients/${client.id}/account`, { email: emailValue }), (r) => {
      setAccount(r.account);
      setLink(r.link);
      setEmail(null);
      toast('Danışan hesabı açıldı');
    });

  const newLink = () =>
    run('link', () => api.post<{ account: PortalAccountInfo; link: PortalLinkResult }>(`/clients/${client.id}/account/link`), (r) => {
      setAccount(r.account);
      setLink(r.link);
    });

  const patch = (k: string, body: { email?: string; isActive?: boolean }, msg: string) =>
    run(k, () => api.patch<{ account: PortalAccountInfo }>(`/clients/${client.id}/account`, body), (r) => {
      setAccount(r.account);
      setEditingEmail(false);
      setEmail(null);
      toast(msg);
    });

  async function toggleActive() {
    if (!acc) return;
    if (acc.isActive) {
      const ok = await confirm({
        title: 'Hesap kapatılsın mı?',
        message: 'Danışan giriş yapamaz ve açık oturumları hemen kapanır. Verileri silinmez; hesabı daha sonra yeniden açabilirsiniz.',
        confirmText: 'Hesabı kapat',
        destructive: true,
      });
      if (!ok) return;
    }
    await patch('active', { isActive: !acc.isActive }, acc.isActive ? 'Hesap kapatıldı' : 'Hesap yeniden açıldı');
  }

  async function remove() {
    const ok = await confirm({
      title: 'Danışan hesabı silinsin mi?',
      message: 'Giriş bilgileri ve oturumlar silinir. Listeler, tarifler ve diğer kayıtlar etkilenmez. Yeniden hesap açmak gerekirse yeni bir bağlantı üretilir.',
      confirmText: 'Hesabı sil',
      destructive: true,
    });
    if (!ok) return;
    await run('delete', () => api.del(`/clients/${client.id}/account`), () => {
      setAccount(null);
      setLink(null);
      toast('Danışan hesabı silindi');
    });
  }

  const status = !acc ? null : !acc.isActive ? (
    <Badge label="Kapalı" tone="danger" />
  ) : acc.activated ? (
    <Badge label="Etkin" tone="success" />
  ) : acc.pendingActivationUntil ? (
    <Badge label="Etkinleştirme bekleniyor" tone="warning" />
  ) : (
    <Badge label="Bağlantının süresi doldu" tone="danger" />
  );

  let body;
  if (q.isPending) body = <Loading />;
  else if (q.error) {
    body = (
      <View style={{ gap: space.sm }}>
        <Notice tone="danger" text={errorMessage(q.error)} />
        <Button title="Tekrar dene" size="sm" variant="secondary" onPress={() => void q.refetch()} style={{ alignSelf: 'flex-start' }} />
      </View>
    );
  } else if (!acc) {
    body =
      client.status === 'ARCHIVED' ? (
        <T variant="caption">Arşivlenmiş danışan için hesap açılamaz.</T>
      ) : (
        <View style={{ gap: space.md }}>
          <TextField label="Giriş e-postası" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} value={emailValue} onChange={setEmail} error={fieldErr} help="Danışan bu adresle giriş yapar." />
          <Button title="Hesap aç ve bağlantı üret" icon="key" loading={pending === 'create'} disabled={!emailValue} onPress={() => void create()} />
        </View>
      );
  } else {
    body = (
      <View style={{ gap: space.md }}>
        {acc.deletionRequestedAt ? (
          <Notice tone="danger" text={`Hesap ve veri silme talebi: ${formatDateTime(acc.deletionRequestedAt)}. KVKK gereği en geç 30 gün içinde sonuçlandırın (danışan kartında "Sil") ve danışana bildirin.`} />
        ) : null}
        <View>
          <KeyValue label="E-posta" value={acc.email} />
          {acc.activatedAt ? <KeyValue label="Etkinleştirildi" value={formatDateTime(acc.activatedAt)} /> : null}
          <KeyValue label="Son giriş" value={acc.lastLoginAt ? formatDateTime(acc.lastLoginAt) : 'Henüz yok'} last={!(!acc.activated && acc.pendingActivationUntil)} />
          {!acc.activated && acc.pendingActivationUntil ? <KeyValue label="Bağlantı geçerli" value={`${formatDateTime(acc.pendingActivationUntil)} tarihine kadar`} last /> : null}
        </View>

        {link ? <LinkBox link={link} client={client} onClose={() => setLink(null)} /> : null}

        {editingEmail ? (
          <View style={{ gap: space.sm }}>
            <TextField label="Yeni giriş e-postası" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} value={emailValue} onChange={setEmail} error={fieldErr} />
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Button title="Kaydet" size="sm" loading={pending === 'email'} onPress={() => void patch('email', { email: emailValue }, 'E-posta güncellendi')} />
              <Button title="Vazgeç" size="sm" variant="ghost" onPress={() => { setEditingEmail(false); setEmail(null); }} />
            </View>
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {acc.isActive ? (
            <Button title={acc.activated ? 'Şifre sıfırlama bağlantısı' : 'Yeni etkinleştirme bağlantısı'} icon="link" size="sm" loading={pending === 'link'} onPress={() => void newLink()} />
          ) : null}
          {!editingEmail ? <Button title="E-postayı değiştir" size="sm" variant="secondary" onPress={() => setEditingEmail(true)} /> : null}
          <Button title={acc.isActive ? 'Hesabı kapat' : 'Hesabı aç'} size="sm" variant="secondary" loading={pending === 'active'} onPress={() => void toggleActive()} />
          <Button title="Sil" size="sm" variant="danger" loading={pending === 'delete'} onPress={() => void remove()} />
        </View>
        <Button title="Danışan giriş sayfası" icon="external-link" size="sm" variant="ghost" onPress={() => void Linking.openURL(`${API_URL}/hesabim/giris`)} style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }} />
      </View>
    );
  }

  return (
    <Card>
      <CardTitle
        title="Danışan hesabı"
        text="Danışan listelerini, tariflerini, randevularını, ölçümlerini, mesajlarını ve paylaşılan dosyaları görür. Görüşme notlarını görmez."
        right={status}
      />
      {body}
    </Card>
  );
}
