// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Giriş — ?rol=danisan (Hesabım) | ?rol=panel (yönetim) */
import { Link, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Form, Notice, Screen, T, TextField } from '@/components/ui';
import { ApiError, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { colors, space } from '@/theme';

export default function Login() {
  const { rol } = useLocalSearchParams<{ rol?: string }>();
  const staff = rol === 'panel';
  const { loginClient, loginStaff } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async () => {
    setError(null);
    setFields({});
    if (!email.trim() || !password) {
      return setFields({ ...(email.trim() ? {} : { email: 'E-posta adresinizi girin' }), ...(password ? {} : { password: 'Şifrenizi girin' }) });
    }
    setPending(true);
    try {
      await (staff ? loginStaff : loginClient)(email.trim().toLowerCase(), password);
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) setFields(e.fields);
      setError(errorMessage(e));
    } finally {
      setPending(false);
    }
  };

  return (
    <Screen title={staff ? 'Panel girişi' : 'Hesabına giriş yap'} subtitle={staff ? 'Nida Akın ve ekibi için yönetim uygulaması.' : 'Beslenme listen, tariflerin ve randevuların burada.'}>
      <Form>
        {error ? <Notice tone="danger" text={error} /> : null}
        <TextField
          label="E-posta"
          value={email}
          onChange={setEmail}
          error={fields.email}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="username"
          autoCorrect={false}
          returnKeyType="next"
        />
        <TextField
          label="Şifre"
          value={password}
          onChange={setPassword}
          error={fields.password}
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={submit}
        />
        <Button title="Giriş yap" onPress={submit} loading={pending} full />
        <View style={{ alignItems: 'center', gap: space.md, marginTop: space.sm }}>
          <Link href={{ pathname: '/sifremi-unuttum', params: { rol: staff ? 'panel' : 'danisan' } }}>
            <T color={colors.goldInk} weight="semibold">Şifremi unuttum</T>
          </Link>
          {!staff ? (
            <T variant="caption" center>
              Hesabın yok mu? Hesaplar diyetisyenin tarafından açılır; sana gelen davet bağlantısıyla şifreni belirleyebilirsin.
            </T>
          ) : null}
        </View>
      </Form>
    </Screen>
  );
}
