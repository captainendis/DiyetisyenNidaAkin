// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Hesap (web: PortalAccountPage) — giriş e-postası ve şifre değişikliği.
 * Sunucu şifre değişince diğer oturumları kapatır ve yeni token döndürür → bu cihazda oturum yenilenir.
 */
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, Card, confirm, KeyValue, Notice, Screen, Section, SwitchField, T, TextField } from '@/components/ui';
import { ApiError, errorMessage, portalApi } from '@/lib/api';
import { useAuth, useClient } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { getPushConsent, onPushConsentChange, pushSupported, setPushConsent, type PushConsent } from '@/lib/push';
import { space } from '@/theme';

export default function AccountScreen() {
  const me = useClient();
  const { adoptSession } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [pushConsent, setPushConsentState] = useState<PushConsent>(null);
  const [deletionAt, setDeletionAt] = useState<string | null>(me.deletionRequestedAt ?? null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const requestDeletion = async () => {
    const ok = await confirm({
      title: 'Hesabının ve verilerinin silinmesini iste',
      message:
        'Talebin diyetisyenine iletilir ve en geç 30 gün içinde sonuçlandırılır. Hesabın kapatılır; ölçümlerin, listelerin, mesajların ve dosyaların kalıcı olarak silinir. Bu işlem geri alınamaz.',
      confirmText: 'Talebi gönder',
      destructive: true,
    });
    if (!ok) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const r = await portalApi.post<{ deletionRequestedAt: string }>('/account/deletion-request', {});
      setDeletionAt(r.deletionRequestedAt);
    } catch (e) {
      setDeleteError(errorMessage(e) || 'Talep gönderilemedi. İnternet bağlantını kontrol edip tekrar dene.');
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    void getPushConsent().then(setPushConsentState);
    return onPushConsentChange(setPushConsentState);
  }, []);

  const submit = async () => {
    setMsg(null);
    setFields({});
    if (next !== again) return setFields({ confirm: 'Şifreler aynı değil' });
    setPending(true);
    try {
      const r = await portalApi.post<{ ok: true; token?: string; csrfToken?: string }>('/auth/change-password', { currentPassword: current, newPassword: next });
      setCurrent('');
      setNext('');
      setAgain('');
      if (r.token && r.csrfToken) await adoptSession('client', r.token, r.csrfToken);
      setMsg({ ok: true, text: 'Şifren değiştirildi. Diğer cihazlardaki oturumların kapatıldı.' });
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        setFields({ current: e.fields.currentPassword ?? '', next: e.fields.newPassword ?? '' });
      }
      setMsg({ ok: false, text: e instanceof ApiError ? e.message : errorMessage(e) || 'Şifre değiştirilemedi.' });
    } finally {
      setPending(false);
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Hesap' }} />
      <Section title="Bilgilerin">
        <Card>
          <KeyValue label="Ad soyad" value={`${me.firstName} ${me.lastName}`} />
          <KeyValue label="Giriş e-postan" value={me.email} last />
        </Card>
        <T variant="caption" style={{ marginTop: space.sm }}>E-posta adresini değiştirmek için diyetisyeninle iletişime geç.</T>
      </Section>

      {pushSupported ? (
        <Section title="Bildirimler">
          <Card>
            <SwitchField
              label="Bildirim almak istiyorum"
              value={pushConsent === 'granted'}
              onChange={(v) => void setPushConsent(v ? 'granted' : 'declined')}
              help="Bildirimler Expo, Inc. (ABD) ile Google veya Apple üzerinden iletilir; metinlerde sağlık bilgisi yer almaz. Kapatırsan bu telefonun kaydı silinir ve aktarım durur."
            />
          </Card>
        </Section>
      ) : null}

      <Section title="Şifreni değiştir">
        <Card>
          <View style={{ gap: space.md }}>
            {msg ? <Notice tone={msg.ok ? 'success' : 'danger'} text={msg.text} /> : null}
            <TextField
              label="Mevcut şifre"
              value={current}
              onChange={setCurrent}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="current-password"
              textContentType="password"
              error={fields.current || undefined}
              required
            />
            <TextField
              label="Yeni şifre"
              value={next}
              onChange={setNext}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
              error={fields.next || undefined}
              help="En az 10 karakter; en az bir harf ve bir rakam."
              required
            />
            <TextField
              label="Yeni şifre (tekrar)"
              value={again}
              onChange={setAgain}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
              error={fields.confirm}
              required
              onSubmitEditing={() => void submit()}
            />
            <Button title={pending ? 'Kaydediliyor…' : 'Şifremi değiştir'} loading={pending} disabled={!current || !next || !again} onPress={() => void submit()} />
          </View>
        </Card>
      </Section>

      <Section title="Hesabını sil">
        <Card>
          <View style={{ gap: space.md }}>
            {deletionAt ? (
              <Notice
                tone="info"
                text={`Silme talebin ${formatDate(deletionAt)} tarihinde alındı. En geç 30 gün içinde sonuçlandırılır ve sana e-postayla bildirilir. Vazgeçersen diyetisyenine haber ver.`}
              />
            ) : (
              <>
                <T variant="caption">
                  Hesabının kapatılmasını ve ölçümlerin, beslenme listelerin, mesajların ve dosyaların dahil tüm verilerinin silinmesini isteyebilirsin. Talep en geç 30 gün içinde sonuçlandırılır. Yasal saklama yükümlülüğü olan kayıtlar varsa yalnızca o süre boyunca saklanır.
                </T>
                {deleteError ? <Notice tone="danger" text={deleteError} /> : null}
                <Button title="Hesabımın ve verilerimin silinmesini iste" variant="danger" loading={deleting} onPress={() => void requestDeletion()} />
              </>
            )}
          </View>
        </Card>
      </Section>
    </Screen>
  );
}
