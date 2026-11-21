// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Panel kullanıcıları (users:manage — yönetici). Yeni kullanıcı panelden eklenir: sistem tek kullanımlık bir
 * şifre belirleme bağlantısı üretir, yönetici bunu iletir, kullanıcı şifresini kendisi koyar (web: UsersSection.tsx).
 */
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Share, Switch, View } from 'react-native';
import { Avatar, Badge, Button, Card, confirm, Fab, Notice, QueryView, Screen, SelectField, Sheet, T, TextField, useToast } from '@/components/ui';
import { api, ApiError, errorMessage } from '@/lib/api';
import { useStaff } from '@/lib/auth';
import { formatDateTime } from '@/lib/format';
import { useApiQuery } from '@/lib/query';
import { colors, radius, space } from '@/theme';

interface U {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  lastLoginAt: string | null;
  role: { key: string; name: string };
}
interface LinkResult {
  link: string;
  expiresAt: string;
  emailed: boolean;
}
type Role = 'ADMIN' | 'DIETITIAN' | 'ASSISTANT';

const ROLE_OPTIONS: { value: Role; label: string; description: string }[] = [
  { value: 'ASSISTANT', label: 'Asistan', description: 'Randevular ve danışan iletişim bilgileri' },
  { value: 'DIETITIAN', label: 'Diyetisyen', description: 'Klinik kayıtlar dahil her şey (kullanıcı yönetimi hariç)' },
  { value: 'ADMIN', label: 'Yönetici', description: 'Her şey, kullanıcı ve danışan hesabı yönetimi dahil' },
];
const EMPTY = { firstName: '', lastName: '', email: '', role: 'ASSISTANT' as Role };

export function UsersSection() {
  const toast = useToast();
  const { user } = useStaff();
  const res = useApiQuery(['settings', 'users'], () => api.get<{ users: U[] }>('/settings/users'));
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<string | null>(null);
  const [link, setLink] = useState<{ name: string; result: LinkResult } | null>(null);

  const toggle = async (u: U) => {
    if (u.isActive && !(await confirm({ title: 'Kullanıcıyı devre dışı bırak', message: `${u.firstName} ${u.lastName} panele giriş yapamayacak ve açık oturumları kapatılacak.`, confirmText: 'Devre dışı bırak', destructive: true }))) return;
    setPending(u.id);
    try {
      await api.patch(`/settings/users/${u.id}`, { isActive: !u.isActive });
      toast(u.isActive ? 'Kullanıcı devre dışı bırakıldı' : 'Kullanıcı etkinleştirildi');
      void res.refetch();
    } catch (e) {
      toast(`Güncellenemedi: ${errorMessage(e)}`, 'error');
    } finally {
      setPending(null);
    }
  };

  const create = async () => {
    setErrors({});
    setPending('create');
    try {
      const r = await api.post<{ user: U; link: LinkResult }>('/settings/users', form);
      setAdding(false);
      setForm(EMPTY);
      // iOS: bir pencere kapanırken diğeri açılamaz — ekleme sayfası kapandıktan sonra göster
      setTimeout(() => setLink({ name: `${r.user.firstName} ${r.user.lastName}`, result: r.link }), 450);
      toast('Kullanıcı eklendi');
      void res.refetch();
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fields);
      toast(`Kullanıcı eklenemedi: ${errorMessage(err)}`, 'error');
    } finally {
      setPending(null);
    }
  };

  const newLink = async (u: U) => {
    setPending(`link-${u.id}`);
    try {
      const r = await api.post<{ link: LinkResult }>(`/settings/users/${u.id}/link`);
      setLink({ name: `${u.firstName} ${u.lastName}`, result: r.link });
    } catch (err) {
      toast(`Bağlantı üretilemedi: ${errorMessage(err)}`, 'error');
    } finally {
      setPending(null);
    }
  };

  const copy = async () => {
    if (!link) return;
    try {
      await Clipboard.setStringAsync(link.result.link);
      toast('Bağlantı kopyalandı');
    } catch {
      toast('Kopyalanamadı. Bağlantıyı seçip elle kopyalayın.', 'error');
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Screen refreshing={res.refreshing} onRefresh={res.refresh} contentStyle={{ paddingBottom: 100 }}>
        <T muted style={{ marginBottom: space.lg }}>Panele erişimi olan kişiler. Yeni kullanıcı şifresini kendisine ilettiğiniz bağlantıyla belirler.</T>
        <QueryView query={res}>
          {({ users }) => (
            <View style={{ gap: space.md }}>
              {users.map((u) => {
                const self = u.id === user.id;
                return (
                  <Card key={u.id} style={{ gap: space.md }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                      <Avatar name={`${u.firstName} ${u.lastName}`} />
                      <View style={{ flex: 1, gap: 3 }}>
                        <T variant="subheading">
                          {u.firstName} {u.lastName}
                          {self ? <T variant="caption"> (siz)</T> : null}
                        </T>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                          <Badge label={u.role.name} tone={u.role.key === 'ASSISTANT' ? 'info' : 'gold'} />
                          {!u.isActive ? <Badge label="Devre dışı" tone="danger" /> : null}
                        </View>
                      </View>
                      {!self ? (
                        <Switch
                          value={u.isActive}
                          disabled={pending === u.id}
                          onValueChange={() => void toggle(u)}
                          accessibilityLabel={`${u.firstName} etkin`}
                          trackColor={{ true: colors.gold, false: colors.line }}
                        />
                      ) : null}
                    </View>
                    <T variant="caption" numberOfLines={2}>
                      {u.email} · {u.lastLoginAt ? `son giriş ${formatDateTime(u.lastLoginAt)}` : 'henüz giriş yapmadı'}
                    </T>
                    {!self && u.isActive ? (
                      <Button title="Şifre bağlantısı üret" icon="link-2" variant="secondary" size="sm" style={{ alignSelf: 'flex-start' }} loading={pending === `link-${u.id}`} onPress={() => void newLink(u)} />
                    ) : null}
                  </Card>
                );
              })}
            </View>
          )}
        </QueryView>
      </Screen>
      <Fab label="Kullanıcı ekle" icon="user-plus" onPress={() => (setErrors({}), setAdding(true))} />

      <Sheet
        visible={adding}
        onClose={() => setAdding(false)}
        title="Kullanıcı ekle"
        subtitle="Kişiye şifresini belirleyeceği tek kullanımlık bir bağlantı üretilir."
        footer={
          <>
            <Button title="Vazgeç" variant="secondary" style={{ flex: 1 }} onPress={() => setAdding(false)} />
            <Button title="Ekle ve bağlantı üret" style={{ flex: 1.4 }} loading={pending === 'create'} onPress={() => void create()} />
          </>
        }
      >
        <TextField label="Ad" required value={form.firstName} error={errors.firstName} onChange={(v) => setForm({ ...form, firstName: v })} />
        <TextField label="Soyad" required value={form.lastName} error={errors.lastName} onChange={(v) => setForm({ ...form, lastName: v })} />
        <TextField label="E-posta" required keyboardType="email-address" autoCapitalize="none" autoCorrect={false} help="Kişi panele bu adresle giriş yapar." value={form.email} error={errors.email} onChange={(v) => setForm({ ...form, email: v })} />
        <SelectField<Role> label="Rol" value={form.role} options={ROLE_OPTIONS} error={errors.role} onChange={(v) => setForm({ ...form, role: v })} />
      </Sheet>

      <Sheet visible={!!link} onClose={() => setLink(null)} title="Şifre belirleme bağlantısı" subtitle={link?.name}>
        {link ? (
          <>
            <Notice
              tone="success"
              text={`Tek kullanımlık; ${formatDateTime(link.result.expiresAt)} tarihine kadar geçerli ve yalnızca şimdi gösteriliyor.${link.result.emailed ? ' Kişinin e-postasına da gönderildi.' : ' Bağlantıyı kişiye siz iletin.'}`}
            />
            <View style={{ borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.surface, padding: space.md }}>
              <T selectable style={{ fontSize: 13 }}>{link.result.link}</T>
            </View>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Button title="Kopyala" icon="copy" style={{ flex: 1 }} onPress={() => void copy()} />
              <Button
                title="Paylaş"
                icon="share"
                variant="secondary"
                style={{ flex: 1 }}
                onPress={() => void Share.share({ message: `Nida Akın paneli için şifrenizi belirleme bağlantısı: ${link.result.link}` }).catch(() => {})}
              />
            </View>
          </>
        ) : null}
      </Sheet>
    </View>
  );
}
