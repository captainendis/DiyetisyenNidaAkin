// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Personel (panel) şifre sıfırlama — e-postadaki …/panel/sifre-sifirla?token=… bağlantısı uygulamada buraya açılır
 * (+native-intent.tsx). Özel şema: nidaakin://sifre-yenile?token=…
 * Web karşılığı: src/views/panel/ResetPasswordPage.tsx. Başarılı olunca sunucu tüm oturumları kapatır;
 * kullanıcı panel girişine yönlendirilir.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { passwordPolicy } from '@shared/schemas';
import { Button, Form, Notice, Screen, TextField } from '@/components/ui';
import { api, ApiError, errorMessage } from '@/lib/api';

const TOKEN = /^[A-Za-z0-9_-]{20,200}$/;

export default function StaffResetPassword() {
  const params = useLocalSearchParams<{ token?: string }>();
  const token = typeof params.token === 'string' && TOKEN.test(params.token) ? params.token : null;
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [invalid, setInvalid] = useState<string | null>(token ? null : 'Şifre sıfırlama bağlantısı eksik veya hatalı.');
  const [pending, setPending] = useState(false);

  const requestNew = () => router.replace({ pathname: '/sifremi-unuttum', params: { rol: 'panel' } });

  const submit = async () => {
    setError(null);
    const f: Record<string, string> = {};
    const p = passwordPolicy.safeParse(password);
    if (!p.success) f.password = p.error.issues[0]?.message ?? 'Geçersiz şifre';
    if (password !== confirmPw) f.confirm = 'Şifreler eşleşmiyor';
    setFields(f);
    if (Object.keys(f).length) return;
    setPending(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      router.replace({ pathname: '/giris', params: { rol: 'panel', bildirim: 'sifre-yenilendi' } });
    } catch (e) {
      if (e instanceof ApiError && e.code === 'INVALID_TOKEN') setInvalid(e.message);
      else if (e instanceof ApiError && e.status === 422) {
        setFields(e.fields);
        setError(e.message);
      } else setError(errorMessage(e));
    } finally {
      setPending(false);
    }
  };

  if (invalid) {
    return (
      <Screen title="Bağlantı geçersiz">
        <Form>
          <Notice tone="danger" text={invalid} />
          <Button title="Yeni bağlantı iste" onPress={requestNew} full />
        </Form>
      </Screen>
    );
  }

  return (
    <Screen title="Yeni şifre belirleyin" subtitle="Panel hesabınız için yeni bir şifre yazın.">
      <Form>
        {error ? <Notice tone="danger" text={error} /> : null}
        <TextField
          label="Yeni şifre"
          value={password}
          onChange={setPassword}
          error={fields.password}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          help="En az 10 karakter; en az bir harf ve bir rakam içermeli."
        />
        <TextField
          label="Yeni şifre (tekrar)"
          value={confirmPw}
          onChange={setConfirmPw}
          error={fields.confirm}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={submit}
        />
        <Button title="Şifreyi güncelle" onPress={submit} loading={pending} full />
      </Form>
    </Screen>
  );
}
