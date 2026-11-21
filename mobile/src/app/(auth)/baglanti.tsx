// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Danışan davet / şifre sıfırlama bağlantısı.
 *  - E-postadaki …/hesabim/etkinlestir?token=… ve …/hesabim/sifre-sifirla?token=… bağlantıları uygulamada
 *    doğrudan buraya açılır (Universal Links / App Links → +native-intent.tsx)
 *  - Derin bağlantı: nidaakin://baglanti?token=…
 *  - Ya da bağlantı "Davet bağlantım var" ekranında buraya yapıştırılır
 * Şifre belirlenince sunucu yeni bir oturum açar; uygulama doğrudan Hesabım'a geçer.
 */
import { useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { Button, Form, Loading, Notice, Screen, T, TextField } from '@/components/ui';
import { ApiError, errorMessage, portalApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type Info = { purpose: 'ACTIVATE' | 'RESET'; firstName: string; email: string };

function extractToken(input: string) {
  const s = input.trim();
  const m = s.match(/[?&]token=([A-Za-z0-9_-]{20,200})/);
  if (m) return m[1]!;
  return /^[A-Za-z0-9_-]{20,200}$/.test(s) ? s : null;
}

export default function LinkScreen() {
  const params = useLocalSearchParams<{ token?: string }>();
  const { adoptSession } = useAuth();
  const [token, setToken] = useState<string | null>(params.token && extractToken(params.token) ? params.token : null);
  const [paste, setPaste] = useState('');
  const [info, setInfo] = useState<Info | null>(null);
  const [invalid, setInvalid] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!token) return;
    setInvalid(null);
    setInfo(null);
    portalApi
      .get<Info>('/auth/token', { token })
      .then(setInfo)
      .catch((e) => setInvalid(errorMessage(e)));
  }, [token]);

  const submit = async () => {
    setError(null);
    setFields({});
    if (password !== confirmPw) return setFields({ confirm: 'Şifreler aynı değil' });
    setPending(true);
    try {
      const res = await portalApi.post<{ token?: string; csrfToken?: string }>('/auth/set-password', { token, password });
      if (res.token && res.csrfToken) await adoptSession('client', res.token, res.csrfToken);
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 422) setFields(e.fields);
        if (e.code === 'INVALID_TOKEN') setInvalid(e.message);
        else setError(e.message);
      } else setError(errorMessage(e));
    } finally {
      setPending(false);
    }
  };

  if (!token) {
    return (
      <Screen title="Davet bağlantısı" subtitle="Diyetisyeninin gönderdiği bağlantıyı (e-posta ya da WhatsApp) kopyalayıp buraya yapıştır.">
        <Form>
          <TextField label="Bağlantı" value={paste} onChange={setPaste} placeholder="https://…/hesabim/etkinlestir?token=…" autoCapitalize="none" autoCorrect={false} rows={3} error={fields.link} />
          <Button
            title="Panodan yapıştır"
            variant="secondary"
            icon="clipboard"
            onPress={async () => setPaste(await Clipboard.getStringAsync())}
          />
          <Button
            title="Devam"
            full
            onPress={() => {
              const t = extractToken(paste);
              if (!t) return setFields({ link: 'Bağlantı tanınmadı. Bağlantının tamamını kopyaladığından emin ol.' });
              setFields({});
              setToken(t);
            }}
          />
        </Form>
      </Screen>
    );
  }

  if (invalid) {
    return (
      <Screen title="Bağlantı geçersiz">
        <Form>
          <Notice tone="danger" text={invalid} />
          <Button title="Başka bir bağlantı dene" variant="secondary" onPress={() => { setToken(null); setInvalid(null); }} />
        </Form>
      </Screen>
    );
  }
  if (!info) return <Loading label="Bağlantı doğrulanıyor…" />;

  const activate = info.purpose === 'ACTIVATE';
  return (
    <Screen title={activate ? 'Hesabını etkinleştir' : 'Yeni şifre belirle'}>
      <Form>
        <T muted>
          Merhaba {info.firstName}. <T weight="semibold">{info.email}</T> için {activate ? 'bir şifre belirle; ardından hesabın açılır.' : 'yeni şifreni yaz.'}
        </T>
        {error ? <Notice tone="danger" text={error} /> : null}
        <TextField label="Şifre" value={password} onChange={setPassword} secureTextEntry autoComplete="new-password" textContentType="newPassword" error={fields.password} help="En az 10 karakter; harf ve rakam içermeli." />
        <TextField label="Şifre (tekrar)" value={confirmPw} onChange={setConfirmPw} secureTextEntry autoComplete="new-password" textContentType="newPassword" error={fields.confirm} />
        <Button title={activate ? 'Hesabımı etkinleştir' : 'Şifremi kaydet'} onPress={submit} loading={pending} full />
      </Form>
    </Screen>
  );
}
