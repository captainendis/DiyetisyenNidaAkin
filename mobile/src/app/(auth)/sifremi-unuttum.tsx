// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Button, Form, Notice, Screen, TextField } from '@/components/ui';
import { api, ApiError, errorMessage, portalApi } from '@/lib/api';

export default function Forgot() {
  const { rol } = useLocalSearchParams<{ rol?: string }>();
  const staff = rol === 'panel';
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState<string>();
  const [done, setDone] = useState<{ message: string; emailConfigured: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async () => {
    setError(null);
    setFieldError(undefined);
    setPending(true);
    try {
      const res = await (staff ? api : portalApi).post<{ message: string; emailConfigured: boolean }>('/auth/forgot-password', { email: email.trim().toLowerCase() });
      setDone(res);
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) setFieldError(e.fields.email);
      else setError(errorMessage(e));
    } finally {
      setPending(false);
    }
  };

  return (
    <Screen title="Şifremi unuttum" subtitle={staff ? 'Panel hesabının e-posta adresini yaz.' : 'Hesabına kayıtlı e-posta adresini yaz.'}>
      <Form>
        {done ? (
          <>
            <Notice tone={done.emailConfigured ? 'success' : 'warning'} text={done.message} />
            {!staff ? <Notice tone="info" text="E-postadaki bağlantıyı bu telefonda açarsan uygulamada şifreni belirleyebilirsin. Ya da bağlantıyı kopyalayıp “Davet bağlantım var” ekranına yapıştır." /> : null}
            <Button title="Girişe dön" variant="secondary" onPress={() => router.back()} />
          </>
        ) : (
          <>
            {error ? <Notice tone="danger" text={error} /> : null}
            <TextField label="E-posta" value={email} onChange={setEmail} error={fieldError} keyboardType="email-address" autoCapitalize="none" autoComplete="email" autoCorrect={false} />
            <Button title="Bağlantı gönder" onPress={submit} loading={pending} disabled={!email.trim()} full />
          </>
        )}
      </Form>
    </Screen>
  );
}
