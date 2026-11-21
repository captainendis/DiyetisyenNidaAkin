// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Hesap & güvenlik: şifre değiştirme, uygulama kilidi, aktif oturumlar (web: settings/SecuritySection.tsx) */
import { useState } from 'react';
import { View } from 'react-native';
import { useAppLock } from '@/components/AppLock';
import { Badge, Button, Card, confirm, ErrorView, Icon, Loading, Screen, SwitchField, T, TextField, useToast } from '@/components/ui';
import { api, ApiError, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDateTime, relativeTime } from '@/lib/format';
import { useApiQuery } from '@/lib/query';
import { colors, space } from '@/theme';
import { FormSection } from '../content/FormBits';

interface SessionRow {
  id: string;
  createdAt: string;
  lastSeenAt: string;
  ip: string | null;
  userAgent: string | null;
  remember: boolean;
  current: boolean;
}

function describeAgent(ua: string | null) {
  if (!ua) return { label: 'Bilinmeyen cihaz', mobile: false };
  // Mobil uygulama istekleri (React Native / Expo) — tarayıcı değil
  if (/okhttp|Expo|CFNetwork|Darwin/i.test(ua)) {
    const os = /Android|okhttp/i.test(ua) ? 'Android' : 'iOS';
    return { label: `Nida Akın uygulaması · ${os}`, mobile: true };
  }
  const mobile = /Mobile|Android|iPhone|iPad/i.test(ua);
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : /curl/i.test(ua) ? 'Komut satırı' : 'Tarayıcı';
  const os = /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) && !mobile ? 'macOS' : /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Linux/.test(ua) ? 'Linux' : '';
  return { label: [browser, os].filter(Boolean).join(' · '), mobile };
}

const EMPTY = { currentPassword: '', newPassword: '', confirm: '' };

export function SecuritySection() {
  const toast = useToast();
  const { adoptSession } = useAuth();
  const lock = useAppLock();
  const [f, setF] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const sessions = useApiQuery(['settings', 'sessions'], () => api.get<{ sessions: SessionRow[] }>('/settings/sessions'));

  const rules = [
    { ok: f.newPassword.length >= 10, label: 'En az 10 karakter' },
    { ok: /[A-Za-zÇĞİÖŞÜçğıöşü]/.test(f.newPassword), label: 'En az bir harf' },
    { ok: /\d/.test(f.newPassword), label: 'En az bir rakam' },
  ];

  const change = async () => {
    const local: Record<string, string> = {};
    if (!f.currentPassword) local.currentPassword = 'Mevcut şifrenizi girin';
    if (rules.some((r) => !r.ok)) local.newPassword = 'Şifre kurallarını karşılamıyor';
    if (f.newPassword !== f.confirm) local.confirm = 'Şifreler eşleşmiyor';
    if (Object.keys(local).length) return setErrors(local);
    setSaving(true);
    setErrors({});
    try {
      const res = await api.post<{ ok: true; csrfToken: string; token?: string }>('/auth/change-password', { currentPassword: f.currentPassword, newPassword: f.newPassword });
      setF(EMPTY);
      // Sunucu tüm oturumları kapatıp bu cihaz için yeni bir oturum açar → yeni token'ı sakla
      if (res.token) await adoptSession('staff', res.token, res.csrfToken);
      else api.setCsrfToken(res.csrfToken);
      toast('Şifreniz değiştirildi. Diğer cihazlardaki oturumlar kapatıldı.');
      void sessions.refetch();
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) setErrors(e.fields);
      else toast(`Şifre değiştirilemedi: ${errorMessage(e)}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const revoke = async (s: SessionRow) => {
    if (!(await confirm({ title: 'Oturumu kapat', message: 'Bu cihazdaki oturum sonlandırılacak; yeniden giriş yapılması gerekecek.', confirmText: 'Oturumu kapat', destructive: true }))) return;
    try {
      await api.del(`/settings/sessions/${s.id}`);
      toast('Oturum kapatıldı');
      void sessions.refetch();
    } catch (e) {
      toast(`Oturum kapatılamadı: ${errorMessage(e)}`, 'error');
    }
  };

  return (
    <Screen refreshing={sessions.refreshing} onRefresh={sessions.refresh}>
      <FormSection title="Şifre değiştir" description="Şifrenizi değiştirdiğinizde diğer tüm cihazlardaki oturumlar kapatılır.">
        <TextField label="Mevcut şifre" secureTextEntry autoComplete="current-password" value={f.currentPassword} error={errors.currentPassword} onChange={(v) => setF({ ...f, currentPassword: v })} />
        <TextField label="Yeni şifre" secureTextEntry autoComplete="new-password" textContentType="newPassword" value={f.newPassword} error={errors.newPassword} onChange={(v) => setF({ ...f, newPassword: v })} />
        <TextField label="Yeni şifre (tekrar)" secureTextEntry autoComplete="new-password" textContentType="newPassword" value={f.confirm} error={errors.confirm} onChange={(v) => setF({ ...f, confirm: v })} />
        <View style={{ gap: 4 }} accessibilityLabel="Şifre kuralları">
          {rules.map((r) => (
            <View key={r.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name={r.ok ? 'check-circle' : 'circle'} size={14} color={r.ok ? colors.successInk : colors.mist} />
              <T variant="caption" color={r.ok ? colors.successInk : colors.muted}>{r.label}</T>
            </View>
          ))}
        </View>
        <Button title="Şifreyi değiştir" loading={saving} onPress={() => void change()} />
      </FormSection>

      <FormSection title="Uygulama kilidi" description="Telefon başkasının elindeyken danışan bilgileri açık kalmasın.">
        {lock.available ? (
          <SwitchField
            label="Face ID / parmak izi kilidi"
            help="Uygulama 2 dakikadan uzun arka planda kalırsa kilitlenir."
            value={lock.enabled}
            onChange={async (v) => {
              const ok = await lock.setEnabled(v);
              if (ok) toast(v ? 'Uygulama kilidi açıldı' : 'Uygulama kilidi kapatıldı');
            }}
          />
        ) : (
          <T variant="caption">Bu cihazda biyometrik kilit kullanılamıyor. Cihaz ayarlarından Face ID ya da parmak izi tanımlayabilirsiniz.</T>
        )}
      </FormSection>

      <FormSection title="Aktif oturumlar" description="Hesabınızın açık olduğu cihazlar. Tanımadığınız bir oturum görürseniz kapatın ve şifrenizi değiştirin.">
        {sessions.isPending ? (
          <Loading />
        ) : sessions.error || !sessions.data ? (
          <ErrorView error={sessions.error} onRetry={() => void sessions.refetch()} />
        ) : (
          <Card padded={false} style={{ shadowOpacity: 0, elevation: 0 }}>
            {sessions.data.sessions.map((s, i) => {
              const a = describeAgent(s.userAgent);
              return (
                <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderBottomWidth: i < sessions.data.sessions.length - 1 ? 1 : 0, borderBottomColor: colors.line }}>
                  <Icon name={a.mobile ? 'smartphone' : 'monitor'} size={20} color={colors.muted} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                      <T variant="subheading">{a.label}</T>
                      {s.current ? <Badge label="Bu cihaz" tone="success" /> : null}
                    </View>
                    <T variant="caption">
                      {s.ip ?? 'IP bilinmiyor'} · son etkinlik {relativeTime(s.lastSeenAt)} · giriş {formatDateTime(s.createdAt)}
                    </T>
                  </View>
                  {!s.current ? <Button title="Kapat" variant="secondary" size="sm" onPress={() => void revoke(s)} /> : null}
                </View>
              );
            })}
          </Card>
        )}
      </FormSection>
    </Screen>
  );
}
